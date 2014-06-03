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
			return when.try(providerFunction, availableResourceMap).then(function _resolveResourceProvision(providedResource){
				resolveProvision(providedResource);
			}, function _rejectResourceProvision(reason){
				rejectProvision(reason);
				return when.reject(reason);
			});
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
		return when.all(self._providers.map(function(providerFunction){
			return providerFunction(resourceMap);
		}));
	});
};

module.exports.CompositionBlock = CompositionBlock;

