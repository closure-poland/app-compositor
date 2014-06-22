var CompositionBlock = require('./CompositionBlock').CompositionBlock;
var when = require('when');

function CompositionManager(){
	this._resourcePromises = {};
}
CompositionManager.prototype.registerResourcePromise = function registerResourcePromise(resourceName, promise){
	this._resourcePromises[resourceName] = promise;
};
CompositionManager.prototype.getResourcePromise = function getResourcePromise(resourceName){
	if(!this._resourcePromises[resourceName]){
		throw new Error('Resource missing: ' + resourceName);
	}
	return this._resourcePromises[resourceName];
};
CompositionManager.prototype.runModules = function runModules(moduleFunctions){
	try{
		var self = this;
		var blocks = [];
		// First, run the module functions so that they may make some declarations (is, requires, provides).
		moduleFunctions.forEach(function _runModuleDeclaration(moduleFunction){
			var compositionBlock = new CompositionBlock(self);
			moduleFunction.call(compositionBlock);
			blocks.push(compositionBlock);
		});
		// Now, we have all the declarations we need and we can proceed to run the modules:
		var blockRunPromises = [];
		blocks.forEach(function _runModuleFromBlock(block){
			blockRunPromises.push(block.run().then(undefined, function(reason){
				return when.reject(reason);
			}));
		});
		// Resolve when all of the composition blocks have been run and all resources provided. We could skip the resources' promises,
		//  since they are redundant regarding blockRunPromises, but we listen to them anyway to help calm when.js.
		return when.all(blockRunPromises.concat(Object.keys(this._resourcePromises).map(function mapResourcePromise(resourceName){
			return self.getResourcePromise(resourceName);
		})));
	}
	catch(preProcessingError){
		return when.reject(preProcessingError);
	}
};

module.exports.CompositionManager = CompositionManager;

