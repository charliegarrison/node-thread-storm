const cluster = require("cluster");
module.exports = function(sessionData,parent) {
 setTimeout(function() {
   //fail test
   //elf.fun.toString();
   parent.completed();
	 cluster.worker.kill();
	 cluster.worker.kill();
 },sessionData.length);
};
