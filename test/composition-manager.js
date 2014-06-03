var CompositionManager = require('../CompositionManager').CompositionManager;
var when = require('when');

describe('CompositionManager', function(){
	describe('#runModules', function(){
		it('should run modules in the correct order', function(done){
			function module1(){
				this.is('module1');
				this.provides('bus', function(resources){
					return when.resolve({publish: function(){ return 'published'; }});
				});
			}

			function module2(){
				this.is('module2');
				this.requires('bus');
				this.provides('server', function(resources){
					if(resources.bus.publish() === 'published'){
						done();
					}
					else{
						done(new Error('Missing resources!'));
					}
				});
			}
			var manager = new CompositionManager();
			manager.runModules([module2, module1]);
		});
		it('should signal finishing the composition by resolving the returned promise', function(done){
			function module1(){
				this.is('module1');
				this.provides('module1', function(resources){
					return when.resolve();
				});
			}

			function module2(){
				this.is('module2');
				this.requires('module1');
				this.provides('module2', function(resources){
					return when.resolve();
				});
			}
			var manager = new CompositionManager();
			manager.runModules([module1, module2]).done(function(){
				done();
			});
		});
		it('should break off execution and report an error if a module fails to load', function(done){
			function failingModule(){
				this.is('failingModule');
				this.provides('failingModule', function(resources){
					throw new Error('Failed to load! No particular reason, too, just feeling like it.');
				});
			}
			var manager = new CompositionManager();
			manager.runModules([failingModule]).done(function errorsMissed(){
				done(new Error('Promise resolved despite errors!'));
			}, function errorsProperlyDetected(){
				done();
			});
		});
	});
});