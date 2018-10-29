var events = require('events'),
  eventEmitter = new events.EventEmitter(),
  threadStorm=module.exports={},
  ee = threadStorm.ee = eventEmitter,
  cluster = require('cluster');



threadStorm.isMaster = cluster.isMaster;
if(cluster.isMaster) {
  var workers={},
    availableWorkers=[],
   CPUs = require('os').cpus(),
   taskMapping={};

   threadStorm.start = function(config) {
     config = config || {
       threadsPerCore: 1
     };
     registerListeners();
     waitForForking();

     CPUs.forEach(function() {
       for(let i=0; i < config.threadsPerCore; i++) {
         cluster.fork();
       }
     });
   };


   threadStorm.runTask = function(task,data) {
     var msgObj,
      msg;
    var worker = getAvailableWorker();//workers[availableWorkers[0]];

     if(worker) {
       msg = "Running Worker";
       msgObj = {
         status: 1,
         msg:msg
       };

       taskMapping[worker.id]=task;
       setWorkerUnAvailable(worker);

       worker.send({
         cmd: 'run',
         task: task,
         data: data
       });

       return true;
     }
     else {
       msg = "Currently there are no available workers to run " + task + ". What a sham.";
       msgObj = {
         status: 0,
         msg:msg
       };
       console.log(msg);
       return false;
     }
   };

    getAvailableWorker = function() {
      var worker = null;

      for(let i = 0; i<availableWorkers.length;i++) {
        if(availableWorkers[i] !== null) {
          worker = workers[availableWorkers[i]];
          break;
        }
      }

      return worker;
    };

    setWorkerAvailable = function(worker) {
      var index = availableWorkers.indexOf(null);//worker.id
      if(index === -1) {
        availableWorkers.push(worker.id);
      }
      else {
        availableWorkers[index] = worker.id;
      }
      console.log("worker " + worker.id + " is ready for work, and a little too excited about it.");
    };

    setWorkerUnAvailable = function(worker) {
      var index = availableWorkers.indexOf(worker.id);

      delete workers[worker.id];

      if(index > -1) {
        availableWorkers[index] = null;
        //availableWorkers.splice(index,index+1);
        console.log("worker " + worker.id + " has been removed from available workers");
      }

    };

    registerListeners = function() {
      cluster.on('fork',function(worker) {

      });

      cluster.on('online',function(worker) {
        workers[worker.id]=worker;

        //console.log("my name is worker "+worker.id+", and I am online");

        setWorkerAvailable(worker);

        worker.on('message', function(msgObj) {
          if(msgObj.msg === "completed") {
            console.log("worker " + worker.id + " has completed running your code! TURN UP!");
            workers[worker.id]=worker;
            setWorkerAvailable(worker);
            ee.emit('taskComplete',{task: taskMapping[worker.id]});
          }
          else {
            ee.emit('msg',msgObj);
          }
        });
      });

      cluster.on('listening',function(worker,address) {
        console.log("worker is listening");
      });

      cluster.on('disconnect', function(worker) {
        if(worker.exitedAfterDisconnect) {
          console.log("worker " + worker.id + " has disconnected. It is ok, it was intentional and very tasteful if I may be so bold.");
        }
        else {
          console.log("worker " + worker.id + " has disconnected. The nerve...");
          ee.emit('taskFailed',{task: taskMapping[worker.id]});
        }
        setWorkerUnAvailable(worker);
      });

      cluster.on('exit', function(worker, code, signal) {
        if(worker.exitedAfterDisconnect) {
          console.log("worker " + worker.id + " died. It completed its mission in life.");
        }
        else {
          console.log("worker " + worker.id + " died. It was a massacre");
        }
        setWorkerUnAvailable(worker);
        cluster.fork();
      });


    };

    waitForForking = function() {
      setTimeout(function() {
        if(Object.keys(workers).length < CPUs.length) {
          console.log("Not all of the workers are up yet. No worries, going to keep waiting for these slackers to come online. You can sit back and watch Dragon Ball Z");
          waitForForking();
        }
        else {
          ee.emit("ready");
          console.log("All workers are up and running. Let's put them to work.");
        }
      },1000);
    };



}
else if(cluster.isWorker) {
  var worker = cluster.worker,
    i=0,
    taskCommunicator,
    taskToRun;

  //can be called from task
  module.exports.taskCommunicator = function(msgObj) {
    process.send(msgObj);
  }

  //you can call when your task is completed
  module.exports.completed = function(msgObj) {
    process.send({msg: 'completed'});
    //worker.kill();
  }

  process.on('message', function(msgObj) {
    if(msgObj.cmd === "run") {
      console.log("worker " + worker.id +  " here, about run task "+msgObj.task+". Thank you for this opportunity, I am stoked. :)");
      taskToRun=require(process.cwd()+"/"+msgObj.task);
      taskToRun(msgObj.data,module.exports);
    }
  });
}
