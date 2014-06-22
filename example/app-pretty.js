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