var CompositionBlock = require('./CompositionBlock').CompositionBlock;
var when = require('when');
var whenKeys = require('when/keys');

function CompositionManager(options){
	this._resourcePromises = {};
	this._options = options || {};
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

CompositionManager.prototype.getOptions = function getOptions(){
	return this._options;
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
		// Resolve when all resources' promises have been resolved.
		return whenKeys.all(self._resourcePromises);
	}
	catch(preProcessingError){
		return when.reject(preProcessingError);
	}
};

module.exports.CompositionManager = CompositionManager;

