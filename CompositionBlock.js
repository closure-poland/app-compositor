var when = require('when');
var parallel = require('when/parallel');

function CompositionBlock(resourceManager){
	this._resourceManager = resourceManager;
	this._requiredResourceNames = [];
	this._providers = [];
	this._name = undefined;
}

CompositionBlock.prototype.is = function is(name){
	this._name = name;
};

CompositionBlock.prototype.requires = function requires(resourceName){
	this._requiredResourceNames.push(resourceName);
};

CompositionBlock.prototype.provides = function provides(resourceName, providerFunction){
	var self = this;
	// Note: below, we rely on the semantics of when.promise - namely, that it runs the resolver function (here, _installResolver) synchronously.
	this._resourceManager.registerResourcePromise(resourceName, when.promise(function _installResolver(resolveProvision, rejectProvision){
		self._providers.push(function provide(availableResourceMap){
			try{
				return when(providerFunction(availableResourceMap)).then(function _resolveResourceProvision(providedResource){
					resolveProvision(providedResource);
				});
			}
			catch(providerFunctionError){
				rejectProvision(providerFunctionError);
			}
		});
	}));
};

CompositionBlock.prototype.run = function run(){
	var self = this;
	var requiredPromises = this._requiredResourceNames.map(function _getResourcePromise(resourceName){
		return self._resourceManager.getResourcePromise(resourceName);
	});
	return when.all(requiredPromises).then(function _runCompositionBlock(requiredResources){
		// Map the resources back to their original names:
		var resourceMap = {};
		for(var i = 0; i < requiredResources.length; ++i){
			resourceMap[self._requiredResourceNames[i]] = requiredResources[i];
		}
		// Now that all the resources are available and mapped, run the providers!
		return parallel(self._providers, resourceMap);
	});
};

module.exports.CompositionBlock = CompositionBlock;

