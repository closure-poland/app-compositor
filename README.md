# app-compositor #
This is a component system for Node.js which lets you build modular Application Composition Layers. Instead of placing 50 requires and countless initialization lines in your server.js file, only to find that the order is wrong and you need 9 levels of indentation to manage dependencies, you can use a module system to your advantage.

The library is very minimal, with its only real dependency being `when`. For application modules which require asynchronous initialization, Promises/A+ are used.

# What it does #

`app-compositor` provides a dependency-based execution sequencing system. It will run the provided initialization functions in an order that is sufficient for all dependencies to be satisfied, or refuse to run the application whatsoever.

# What it does not do #

This is not an autoloader. It will not `require` your modules for you (as of now) nor pass them as arguments. It is the programmer's (or rather, the composition layer implementor's) duty to pass all required resources for an application to launch fully.

# Usage #

## Before refactoring ##
With app-compositor, you divide your application into runnable modules and encapsulate them in functions. For example, consider this simple app which displays some entries from a MongoDB collection over HTTP:

```js
var mongodb = require('mongodb');
var http = require('http');
mongodb.MongoClient.connect('mongodb://127.0.0.1:49153/test', function initializeServer(error, database){
    if(error){
        console.error(error);
        return;
    }
    var server = http.createServer(function serveCollectionView(request, response){
        database.collection('movies').find().toArray(function printMovies(error, entries){
            if(error){
				response.writeHead(500, 'DB error');
				response.end('Database error: ' + error.toString());
				return;
			}
			response.writeHead(200, {
				'Content-Type': 'application/json; encoding=utf-8'
			});
			response.end(JSON.stringify(entries));
        });
    });
	server.listen('8888');
});
```

In case you'd like to run the example and need some data for the collection:
```
db.movies.insert({title: 'Pulp Function', slogan: 'You won\'t know the FUN til you\'ve seen the FUNCTION'});
```

## After refactoring ##
Now, we set out to refactor the application's main file into pretty, extensible code. We are going to do several things:

1. Split the DB server connection and the HTTP server socket creation into separate functions
2. Make it so that their respective functions return the constructed resources via promises instead of callbacks where necessary
3. Define a dependency of the HTTP server upon a functioning MongoDB connection (in a real application, the HTTP server would probably be a framework such as Express and various middlewares/routes would be attached separately).

This is the same file, refactored into separated modules:
```js
var compositor = require('app-compositor');
var manager = new compositor.CompositionManager();

function database(){
	var when = require('when');
	this.is('database');
	this.provides('database', function(dependency){
		// The "dependency" getter function does not allow access to any resources in this module, because we have declared no dependencies using this.requires().
		var mongodb = require('mongodb');
		// The "provider" function should return a promise if it operates asynchronously. This promise will later be resolved with a working DB connection.
		return when.promise(function connectToDB(resolve, reject){
			mongodb.MongoClient.connect('mongodb://127.0.0.1:49153/test', function connected(error, database){
				if(error){
					reject(error);
					return;
				}
				resolve(database);
			});
		});
	});
}

function web(){
	var when = require('when');
	this.is('web');
	this.requires('database');
	this.provides('web', function(dependency){
		var http = require('http');
		var movieCollection = dependency('database').collection('movies');
		var server = http.createServer(function serveCollectionView(request, response){
			movieCollection.find().toArray(function printMovies(error, entries){
				if(error){
					response.writeHead(500, 'DB error');
					response.end('Database error: ' + error.toString());
					return;
				}
				response.writeHead(200, {
					'Content-Type': 'application/json; encoding=utf-8'
				});
				response.end(JSON.stringify(entries));
			});
		});
		// Since we don't initialize the server asynchronously, we can simply return it without using Promises.
		server.listen(8888);
		return server;
	});
}

manager.runModules([database, web]).done(function applicationCompositionFinished(results){
	console.log('Composition finished! The application is now running.');
}, function handleCompositionError(error){
	console.error('Composition error:', error);
});
```

Notice how we could just cut database() and web() from this file and move them to their own CommonJS modules. Then, it's just a matter of calling require() and passing them into the composition layer together.

# The magic API #
Every module needs to be a function. Such a function shall be called with "this" bound to a special object having the following API:

## this.is(name) ##
Defines the name of the current module. Currently unused - in future releases, it will probably allow easier debugging by labelling error messages with the module name.

## this.provides(resourceName, creationFunction) ##
Defines a resource-providing function for the module. The resource name is a text label for whatever the function returns, so that it may be recognized by other modules.
The creation function accepts one argument, a **dependency getter**.

Note that, if a module defines multiple resource-providing functions (via multiple calls to this.provides()), then those functions will be called completely independently, perhaps at various times and in random order (so long as the order of dependencies is preserved).

## this.requires(resourceName) ##
Requests that all resource-providing creation functions declared in this module should be given access to a particular resource.
If a resource is not available during application composition (because no module `provides()` it), running is aborted and a rejection is generated instead of fulfillment.
`this.requires` needs to be called for every resource that the programmer intends to use in resource creation functions via the dependency getter.

## dependency getter ##

The dependency getter is a function that is passed into the resource creation function as the sole argument. It has the following signature:
`getDependency(dependencyName:string) : anything`

The resource creation function can obtain access to other resources (that the module has previously declared as needed via `this.requires`) by calling the dependency getter.
If the resource has not been declared as a dependency of the current composition module, an Error is thrown.

## manager.runModules([ module1, module2, ... ]) ##

Runs the specified set of modules in an order that ensures all dependencies are fulfilled for every module.
Returns a promise that:
* Fulfills with a key-value map of the generated resources (declared provided name => generated value) if composition succeeds and every module has been run
* Rejects with an app-compositor-specific error if some dependencies are determined to be insatisfiable when gathering dependency data (because of missing resources or a dependency cycle)
* Rejects with an app-compositor-specific error if a module tries to obtain an illegal (undeclared) dependency at resource generation time
* Rejects with the original error if a resource generation function throws an error or a promise returned by the resource generation function rejects

# Missing functionality #
Pre- and postconditions for resource generation functions and generated resources respectively are currently missing. Thus, in large applications, if a dependency naming mistake should occur, or if a module generates a malformed/emtpty resource, the source of the error might be non-obvious.
A nice future addition might be an option for modules to declare what they expect their generated resources to look like and what methods/properties their required dependencies must possess.
