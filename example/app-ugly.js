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