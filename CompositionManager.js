var CompositionBlock = require('./CompositionBlock').CompositionBlock;
var when = require('when');

function CompositionManager(){
	this._resourcePromises = {};
}
CompositionManager.prototype.registerResourcePromise = function registerResourcePromise(resourceName, promise){
	this._resourcePromises[resourceName] = promise;
};
CompositionManager.prototype.getResourcePromise = function getResourcePromise(resourceName){
	return this._resourcePromises[resourceName];
};
CompositionManager.prototype.runModules = function runModules(moduleFunctions){
	var self = this;
	var blocks = [];
	// First, run the module functions so that they may make some declarations (is, requires, provides).
	moduleFunctions.forEach(function _runModuleDeclaration(moduleFunction){
		var compositionBlock = new CompositionBlock(self);
		moduleFunction.call(compositionBlock);
		blocks.push(compositionBlock);
	});
	// Now, we have all the declarations we need and we can proceed to run the module:
	var blockRunPromises = [];
	try{
		blocks.forEach(function _runModuleFromBlock(block){
			blockRunPromises.push(block.run());
		});
	}
	catch(runningError){
		return when.reject(runningError);
	}
	return when.all(blockRunPromises);
};

module.exports.CompositionManager = CompositionManager;

