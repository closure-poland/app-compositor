# app-compositor #
This is a component system for Node.js which lets you build modular Application Composition Layers. Instead of placing 50 requires and countless initialization lines in your server.js file, only to find that the order is wrong and you need 9 levels of indentation to manage dependencies, you can use a module system to your advantage.

The library is very minimal, with its only real dependency being `when`. For application modules which require asynchronous initialization, Promises/A+ are used.

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
	this.provides('database', function(dependencies){
		// The "dependencies" object will be empty here, as we declared none.
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
	this.provides('web', function(dependencies){
		var http = require('http');
		var movieCollection = dependencies.database.collection('movies');
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
The creation function accepts one argument, `dependencies`, being an object (a hash-map) of resources where the key is the name declared in this.requires() and the value is the resource produced under that name.

Note that, if a module defines multiple resource-providing functions (via multiple calls to this.provides()), then those functions will be called completely independently, perhaps at various times and in random order (so long as the order of dependencies is preserved).

## this.requires(resourceName) ##
Requests that all resource-providing creation functions in this module should be given a particular resource.

# Missing functionality #
Due to the lack of a pre-processing stage, this library can not currently detect dependency cycles. Thus, the programmer is responsible for checking whether circular dependencies occur in their program.