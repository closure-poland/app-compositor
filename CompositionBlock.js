var when = require('when');
var parallel = require('when/parallel');

var constants = require('./constants');

function CompositionBlock(setupFunction){
	var self = this;
	self.name = null;
	self.dependencies = [];
	self.providedName = null;
	self.providerFunction = null;
	var moduleContext = {
		is: function is(name){
			self.name = name;
		},
		requires: function requires(dependencyName){
			self.dependencies.push(dependencyName);
		},
		provides: function provides(dependencyName, providerFunction){
			self.providedName = dependencyName;
			self.providerFunction = providerFunction;
		}
	};
	setupFunction.call(moduleContext);
}

CompositionBlock.prototype.getProvidedName = function getProvidedName(){
	return this.providedName;
};

CompositionBlock.prototype.getDependencies = function getDependencies(){
	return this.dependencies.slice();
};

CompositionBlock.prototype.run = function run(dependencies){
	function getDependency(name){
		if(Object.hasOwnProperty.call(dependencies, name)){
			return dependencies[name];
		}
		else{
			throw new Error('Failed to get dependency "' + name + '" - use this.requires(\'' + name + '\') to declare it first.');
		}
	}
	
	return when.try(this.providerFunction, getDependency);
};

module.exports.CompositionBlock = CompositionBlock;