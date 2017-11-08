// Node vs browser behavior
if (typeof module !== 'undefined') {
    var binarytree = require('./trees/binarytree'),
        bst = require('./trees/bst.js'),
        rbt = require('./trees/rbt.js')
} else {
    var scheduler = {},
        exports = scheduler;
}

function roundTo(n, digits) {
    if (digits === undefined) {
    digits = 0;
    }

    var multiplicator = Math.pow(10, digits);
    n = parseFloat((n * multiplicator).toFixed(11));
    var test =(Math.round(n) / multiplicator);
    return +(test.toFixed(digits));
}

var DELAY = 2000;
var time_queue, time_queue_idx, min_vruntime, running_task, results, start_ms, 
curTime, total_weight, min_granularity, latency;


// Display element variables
var curTimeDisplay;

function initialiseDisplay() {
    curTimeDisplay = document.getElementById("curTimeDisplay");
    curTaskDisplay = document.getElementById("curTaskDisplay");
    messageDisplay = document.getElementById("messageDisplay");
}

function initialiseScheduler(tasks) {

    // queue of tasks sorted in start_time order
    time_queue = tasks.task_queue;
    // index into time_queue of the next nearest task to start
    time_queue_idx = 0;

    // min_vruntime is set to the smallest vruntime of tasks on the
    // timeline
    min_vruntime = 0;

    // current running task or null if no tasks are running.
    running_task = null;

    // current time in millis
    curTime = 0;

    total_weight = 0;

    // Total number of tasks that are currently in timeline + running task
    num_of_tasks_until_curTime = 0;

    // Min time process can run before preemption
    min_granularity = 0.75*1000;

    // Period in which all tasks are scheduled at least once
    latency = 6*1000;

    // Computes weight from nice value of all tasks
    updateWeights(time_queue);


    // Initialize statistics gathering
    results = {time_data: []};
    start_ms = new Date().getTime();
    binarytree.RESET_STATS();
}

function addFromTaskQueue(tasks, timeline, callback) {
    // Check tasks at the beginning of the task queue. Add any to
    // the timeline structure when the start_time for those tasks
    // has arrived.
    while (time_queue_idx < time_queue.length &&
           (curTime >= time_queue[time_queue_idx].start_time)) {
        num_of_tasks_until_curTime++;
        var new_task = time_queue[time_queue_idx++];
        // new tasks get their vruntime set to the current
        // min_vruntime
        new_task.vruntime = min_vruntime;
        new_task.truntime = 0;
        new_task.actual_start_time = curTime;
        timeline.insert(new_task);
        curTree.insert('n', new_task.vruntime, new_task.id);
        updateMessageDisplay("Adding " + new_task.id + " with vruntime " + new_task.vruntime);
        //updateMessageDisplay("Adding " + new_task.id);
        update(curTree);

        updateSummationWeights(new_task.weight);
    }

    updateSlices(time_queue, Math.max(latency, min_granularity*num_of_tasks_until_curTime));
}

function insertRunningTaskBack(tasks, timeline, callback) {
    // If there is a task running and its vruntime exceeds
    // min_vruntime then add it back to the timeline. Since
    // vruntime is greater it won't change min_vruntime when it's
    // added back to the timeline.
    if (running_task && (running_task.vruntime > min_vruntime) && (running_task.this_slice > running_task.slice)) {
        timeline.insert(running_task);
        curTree.insert('n', running_task.vruntime, running_task.id);
        updateMessageDisplay("Inserting " + running_task.id + " with vruntime " + running_task.vruntime);
        //updateMessageDisplay("Inserting " + running_task.id);
        update(curTree);
        running_task = null;
        updateCurTaskDisplay("-");
    }
}

function findRunningTask(tasks, timeline, callback) {
    // If there is no running task (which may happen right after
    // the running_task is added back to the timeline above), find
    // the task with the smallest vruntime on the timeline, remove
    // it and set it as the running_task and determine the new
    // min_vruntime.
    if (!running_task && timeline.size() > 0) {
        var min_node = timeline.min();
        running_task = min_node.val;
        running_task.this_slice = 0;
        timeline.remove(min_node);
        curTree.remove(curTree.min());
        updateMessageDisplay("Removing " + running_task.id + " with vruntime " + running_task.vruntime);
        //updateMessageDisplay("Removing " + running_task.id);
        updateCurTaskDisplay(running_task.id);
        update(curTree);
        if (timeline.size() > 0) {
            min_vruntime = timeline.min().val.vruntime
            updateMessageDisplay("Updating min_vruntime to " + min_vruntime);
        }
    }

    // Results data for this time unit/tick
    var tresults = {running_task: null,
                    completed_task: null};

    // Update the running_task (if any) by increasing the vruntime
    // and the truntime. If the running task has run for it's full
    // duration then report it as completed and set running_task
    // to null.
    var task_done = false;
    if (running_task) {
        running_task.vruntime += roundTo(1024/(1000*running_task.slice), 2);
        running_task.truntime++;
        running_task.this_slice++;
        tresults.running_task = running_task;
        //updateMessageDisplay(curTime + ": " + running_task.id);
        if (running_task.truntime >= running_task.duration) {
            running_task.completed_time = curTime;
            tresults.completed_task = running_task
            task_done = true; // Set running_task to null later
            //updateMessageDisplay("Completed task:", running_task.id);
            num_of_tasks_until_curTime--;
            updateSummationWeights(-1*running_task.weight);
            updateMessageDisplay(running_task.id + " is over")
            updateCurTaskDisplay("-");
        }
    }

    tresults.num_tasks = timeline.size() + (running_task ? 1 : 0);

    results.time_data[curTime] = tresults;

    if (task_done) {
        running_task = null;
    }

    curTime++;
}

function setDelay(value) {
    DELAY = value;
}

// Run once in initialise
function updateWeights(tasks) {
    for (var i=0 ; i<tasks.length ; i++) {
        tasks[i].weight = Math.pow(1.25, -1*tasks[i].nice) * 1024;
    }
}

// Run every time a new task is added
function updateSummationWeights(value) {
    total_weight += value;
}

//
function updateSlices(tasks, period) {
    updateMessageDisplay("Updating Slices");
    for (var i=0 ; i<tasks.length; i++) {
        if (tasks[i].start_time > curTime) {
            break;
        }
        if (tasks[i].truntime >= tasks[i].duration) {
            continue;
        }
        tasks[i].slice = roundTo(((tasks[i].weight * period) / (1000* total_weight)), 2); // divide by 1000 to convert to ms
        console.log("period = " + period + " total_weight = " + roundTo(total_weight,0));
        updateMessageDisplay("Task " + tasks[i].id + " has slice = " + roundTo(tasks[i].slice, 2));
    }
}

function nextIteration(tasks, timeline, callback) {
    if (curTime < tasks.total_time) {
        updateMessageDisplay("CPU Time = " + curTime);
        // Periodic debug output
        updateCurTimeDisplay(curTime);

        setTimeout(function(){
            addFromTaskQueue(tasks, timeline, callback);
        }, DELAY/3);
        setTimeout(function(){
            insertRunningTaskBack(tasks, timeline, callback);
        }, 2*DELAY/3);
        setTimeout(function(){
            findRunningTask(tasks, timeline, callback);
        }, 3*DELAY/3);

        if (callback) {
            callback(curTime, results);
        }

        return new Promise(resolve => {
          setTimeout(() => {
            resolve(nextIteration(tasks, timeline, callback));
          }, DELAY);
        });
    } else {
        return;
    }
}

function returnResults(tasks, timeline, callback) {
    // Put any currently running task back in the timeline
    if (running_task) {
        timeline.insert(running_task);
    }

    //binarytree.RESET_STATS();
    results.node_stats = binarytree.GET_STATS();
    results.elapsed_ms = (new Date().getTime())-start_ms;

    return results;
}

// runScheduler: Run scheduler algorithm
async function runScheduler(tasks, timeline, callback) {
    updateMessageDisplay("Scheduler Started");
    initialiseScheduler(tasks);
    initialiseDisplay();
    await nextIteration(tasks, timeline, callback);
    updateMessageDisplay("Scheduler Finishes");
    return returnResults(tasks, timeline, callback);    
}

function updateCurTimeDisplay(curTime) {
    curTimeDisplay.innerText = curTime;
}

function updateCurTaskDisplay(curTask) {
    curTaskDisplay.innerText = curTask;
}

function updateMessageDisplay(message) {
    console.log(message);
    messageDisplay.value += message + "\n";
    messageDisplay.scrollTop = messageDisplay.scrollHeight;
}

function generateSummary(tasks, timeline, results) {
    var out = "", tnodes = [], hvals = [];
    timeline.reduce(null, function (_, node) {
        var task = node.val;
        tnodes.push(task.id + ":" + task.vruntime +
                    (node.color ? "/" + node.color : ""));
    }, "in");

    for (var i=0; i < results.time_data.length; i++) {
        var t = results.time_data[i];
        hvals.push(t.running_task ? t.running_task.id : "_");
    }
    out += "Timeline: ";
    out += tnodes.join(",");
    out += "\nTask history: ";
    out += hvals.join(",");
    out += "\n";
    return out;
    
}

function generateReport(tasks, timeline, results, mode) {
    var reads = 0, writes = 0, total = 0, completed = 0, out = "";

    switch (mode) {
    case 'summary': case 'csv': case 'report': case 'detailed': break;
    default:
        throw new Error("Unknown reporting mode '" + mode + "'");
    }


    if (mode === "summary" ) {
        return generateSummary(tasks, timeline, results);
    }

    // General info on the original tasks
    if (mode === 'detailed') {
        out += "Task Queue:\n";
        for (var i=0; i < tasks.task_queue.length; i++) {
            var t = tasks.task_queue[i];
            out += t.id + " " + t.start_time + " " + t.duration + "\n";
            //console.log(tasks.task_queue);
        }
    }

    // A chronological summary of the state at each time
    if (mode === 'detailed') {
        out += "\ntime [tasks]: running_task, completed?\n";
    }
    for (var i=0; i < results.time_data.length; i++) {
        var t = results.time_data[i],
            msg = "  " + i + " [" + t.num_tasks + "]: ";
        if (t.running_task) {
            msg += t.running_task.id;
        }
        if (t.completed_task) {
            msg += ", Completed";
            completed++;
        }
        if (mode === 'detailed') {
            out += msg + "\n";
        }
    }

    // Sum all the reads and writes
    for (var r in results.node_stats.read) {
        reads += results.node_stats.read[r];
    }
    for (var r in results.node_stats.write) {
        writes += results.node_stats.write[r];
    }
    total = reads+writes;

    if (mode === 'csv') {
        // Report summary statistics
        // header is printed by caller
        out += tasks.num_of_tasks + ",";
        out += tasks.total_time + ",";
        out += completed + ",";

        out += results.elapsed_ms + ",";
        out += reads + ",";
        out += writes + ",";
        out += total + ",";
        out += (completed/results.elapsed_ms) + ",";
        out += (completed/total);
    } else {
        // Report summary statistics
        out += "Total Tasks: " + tasks.num_of_tasks + "\n";
        out += "Total Time: " + tasks.total_time + "\n";
        out += "Completed Tasks: " + completed + "\n";

        out += "Wallclock elapsed time: " + results.elapsed_ms + "ms\n";
        out += "Node operations reads  : " + reads + "\n";
        out += "                writes : " + writes + "\n";
        out += "                total  : " + total + "\n";
        out += "Throughput: " + (completed/results.elapsed_ms) + " completed tasks/ms\n";
        out += "            " + (completed/total) + " completed tasks/operation\n";
        //console.log("Tasks per tick:", tasks_per_tick);
    }

    return out;
}

function getTimelineByName(name) {
    function vsort(a,b) {
            return a.val.vruntime - b.val.vruntime;
    }

    // Pick the timeline tree structure based on the string name
    var timeline;
    switch (name.toLowerCase()) {
    case 'bst':       timeline = new bst.BST(vsort); break;
    case 'rbt':       timeline = new rbt.RBT(vsort); break;
    case 'heaptree':  timeline = new heaptree.HeapTree('min', vsort); break;
    case 'heaparray': timeline = new heaparray.HeapArray('min', vsort); break;
    default:          throw new Error("Unknown timeline name '" + name + "'");
    }
    return timeline;
}

function usage() {
    console.log("node scheduler.js [--summary|--csv|--report|--detailed] bst|rbt|heaptree|heaparray TASK_FILE");
    process.exit(2);
}    

if (typeof require !== 'undefined' && require.main === module) {
    // we are being run directly so load the task file specified on
    // the command line pass the data to runScheduler using an
    // RedBlackTree for the timeline
    if (process.argv.length < 4) {
        usage();
    }

    var fs = require('fs');
    var tasksModule = require('./tasks');
    var mode = "summary";

    if (process.argv[2].slice(0,2) === "--") {
        mode = process.argv[2].slice(2);
        process.argv.splice(2,1);
    }

    var timeline = getTimelineByName(process.argv[2]);
    var fileName = process.argv[3];
    var data = fs.readFileSync(fileName, 'utf8');
    var tasks = tasksModule.parseTasks(data);

    // Run the scheduler algorithm
    var results = runScheduler(tasks, timeline);

    // Print a report from the results
    if (mode === 'csv') {
        console.log("total_tasks,total_time,completed_tasks,elapsed_ms,read_ops,write_ops,total_ops,tasks/ms,tasks/op");
    } else if (mode !== 'summary') {
        console.log("Running with:", timeline.name);
    }
    console.log(generateReport(tasks, timeline, results, mode));
} else {
    // we are being required as a module so export the runScheduler
    // function
    exports.runScheduler = runScheduler;
    exports.generateReport = generateReport;
    exports.getTimelineByName = getTimelineByName;
}


// -----------------------------------------------------------------------------------------------

var $ = function(s) { return document.querySelector(s); };

var margin = {top: 20, right: 120, bottom: 20, left: 120},
    width = 960 - margin.right - margin.left,
    height = 600 - margin.top - margin.bottom;
    
var i = 0,
    duration = 750,
    trees = {
              bst: new bst.BST(),
              rbt: new rbt.RBT()
           },
    curTree = trees['rbt'],
    root;

var nilIdx = 0,
    tree = d3.layout.tree()
    .size([width, height])
    .children(function(n) {
        var c = [];
        if (n.val !== 'NIL') {
            if (n.left.val === 'NIL') {
                c.push({id: "NIL" + (nilIdx++), p: {}, val:'NIL'});
            } else {
                c.push(n.left);
            }
            if (n.right.val === 'NIL') {
                c.push({id: "NIL" + (nilIdx++), p: {}, val:'NIL'});
            } else {
                c.push(n.right);
            }
        }
        //console.log(n.val, c);
        return c;
    })
    .sort(function(a, b) {
        if (a.val !== 'NIL' && b.val !== 'NIL') {
            return a.cmp(b);
        } else {
            return -1;
        }
    })

var diagonal = d3.svg.diagonal()
    .projection(function(d) { return [d.x, d.y]; });

var svg = d3.select("#svg")
    .attr("width", width + margin.right + margin.left)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

//d3.select(self.frameElement).style("height", "800px");

function nodeColor(n) {
    if (n.color === 'r') {
        return "red";;
    } else {
        return "dimgrey";;
    }
}

function update(sourceTree) {
  root = sourceTree.root();

  if (root === NIL) {
      root = {p: {}, val: 'NIL'};
  }

  root.x0 = height / 2;
  root.y0 = 0;

  // Don't update the read counts while scanning the tree
  RESET_STATS();

  // Compute the new tree layout.
  var nodes = tree.nodes(root).reverse(),
      links = tree.links(nodes);

  // Update the nodes…
  var node = svg.selectAll("g.node")
      .data(nodes, function(d) { return d.id; });

  // Enter any new nodes at the parent's previous position.
  var nodeEnter = node.enter().append("g")
      .attr("class", "node")
      .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });

  nodeEnter.append("circle")
      .attr("r", 1e-6)
      .style("fill", nodeColor)
      .style("stroke", function(n) { return d3.rgb(nodeColor(n)).darker(); });

  nodeEnter.append("text")
      .attr("x", function(d) { return d.children ? -10 : 10; })
      .attr("dy", ".35em")
      .attr("text-anchor", function(d) { return d.children ? "end" : "start"; })
      .text(function(d) { if (d.val !== 'NIL') { return d.name + ", " + roundTo(d.val, 2); }})
      .style("fill-opacity", 1e-6);

  // Transition nodes to their new position.
  var nodeUpdate = node.transition()
      .duration(duration)
      .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });

  nodeUpdate.select("circle")
      .attr("r", function(n) {
          if (n.val !== 'NIL') {
              return 4.5;
          } else {
              return 1.5;
          }
      })
      .style("fill", nodeColor)
      .style("stroke", function(n) { return d3.rgb(nodeColor(n)).darker(); });

  nodeUpdate.select("text")
      .style("fill-opacity", 1);

  // Transition exiting nodes to the parent's new position.
  var nodeExit = node.exit().transition()
      .duration(duration)
      .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; })
      .remove();

  nodeExit.select("circle")
      .attr("r", 1e-6);

  nodeExit.select("text")
      .style("fill-opacity", 1e-6);

  // Update the links…
  var link = svg.selectAll("path.link")
      .data(links, function(d) { return d.target.id; });

  // Enter any new links at the parent's previous position.
  link.enter().insert("path", "g")
      .attr("class", "link")
      .attr("d", function(d) {
        var o = {x: d.source.x, y: d.source.y};
        return diagonal({source: o, target: o});
      });

  // Transition links to their new position.
  link.transition()
      .duration(duration)
      .attr("d", diagonal);

  // Transition exiting nodes to the parent's new position.
  link.exit().transition()
      .duration(duration)
      .attr("d", function(d) {
        var o = {x: d.source.x, y: d.source.y};
        return diagonal({source: o, target: o});
      })
      .remove();

  // Stash the old positions for transition.
  nodes.forEach(function(d) {
    d.x0 = d.x;
    d.y0 = d.y;
  });

  // Update the stats values
  var reads = 0, writes = 0;
  //console.log(curTree.STATS);
  for (var r in curTree.STATS.read) {
    reads += curTree.STATS.read[r];
  }
  for (var r in curTree.STATS.write) {
    writes += curTree.STATS.write[r];
  }
  // $('#stats_reads').innerText = reads;
  // $('#stats_writes').innerText = writes;

  // Reset the stats to be the internal one for this tree
  RESET_STATS(curTree.STATS);
}

// Add a STATS structure to each tree

for (var t in trees) {
    RESET_STATS();
    trees[t].STATS = STATS;
}

update(curTree);
