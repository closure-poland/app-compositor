var CompositionBlock = require('./CompositionBlock').CompositionBlock;
var when = require('when');
var whenKeys = require('when/keys');

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
		var blocks = {};
		// First, run the module functions so that they may make some declarations (is, requires, provides) and gather the resulting blocks.
		moduleFunctions.forEach(function _runModuleDeclaration(moduleFunction){
			var compositionBlock = new CompositionBlock(moduleFunction);
			var blockName = compositionBlock.getProvidedName();
			blocks[blockName] = compositionBlock;
		});
		// Now, we have all the declarations we need and we can proceed to run the modules, in dependency ordering:
		var blockRunPromises = Object.create(null);
		var gatheredPromiseCount = 0;
		var desiredPromiseCount = Object.keys(blocks).length;
		var gatheredInLastIteration;
		do{
			gatheredInLastIteration = 0;
			Object.keys(blocks).forEach(function runModuleFromBlock(blockName){
				var block = blocks[blockName];
				var dependencyNames = block.getDependencies();
				var dependencies = {};
				var dependenciesMet = true;
				dependencyNames.forEach(function(dependencyName){
					if(blockRunPromises[dependencyName]){
						dependencies[dependencyName] = blockRunPromises[dependencyName];
					}
					else{
						dependenciesMet = false;
					}
				});
				// Check if all dependencies are already being / have been run. If not, skip this block and come back to it later when other promises have appeared, hopefully.
				if(dependenciesMet){
					blockRunPromises[blockName] = whenKeys.all(dependencies).then(block.run.bind(block));
					gatheredPromiseCount += 1;
					gatheredInLastIteration += 1;
					delete blocks[blockName];
				}
			});
			
			
		} while(gatheredPromiseCount < desiredPromiseCount && gatheredInLastIteration > 0);
		// Check if we've processed all blocks into promises successfully. If not, it means that at least one of them has unmet dependencies.
		if(gatheredPromiseCount < desiredPromiseCount){
			throw new Error('Unmet dependencies!');
		}
		// Resolve when all resources' promises have been resolved.
		return whenKeys.all(blockRunPromises);
	}
	catch(preProcessingError){
		return when.reject(preProcessingError);
	}
};

module.exports.CompositionManager = CompositionManager;

