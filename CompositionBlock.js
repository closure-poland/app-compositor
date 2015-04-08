var when = require('when');
var parallel = require('when/parallel');
var constants = require('./constants');

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
	var options = this._resourceManager.getOptions();
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
		if(options.verbosity >= constants.VERBOSITY_DEBUG){
			console.log('[I] Starting module:', self._name);
		}
		
		var longInitTimeout;
		// Track whether the warning has been fired. If it has, the "module started" message will be mandatory so as to relieve the watcher.
		var warningFired = false;
		if(options.verbosity >= constants.VERBOSITY_WARNING){
			longInitTimeout = setTimeout(function(){
				warningFired = true;
				console.log('[W] Module taking over 10s to start:', self._name);
			}, 10000);
		}
		return when.all(self._providers.map(function(providerFunction){
			return providerFunction(resourceMap);
		})).tap(function() {
			clearTimeout(longInitTimeout);
			
			if(options.verbosity >= constants.VERBOSITY_DEBUG || warningFired){
				console.log('[I] Module started:', self._name);
			}
		});
	});
};

module.exports.CompositionBlock = CompositionBlock;

