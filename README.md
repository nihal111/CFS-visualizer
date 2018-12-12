# CFS-Visualizer

A visualisation for the Completely Fair Scheduler used in Linux Kernels. Available at [https://nihal111.github.io/CFS-visualizer/](https://nihal111.github.io/CFS-visualizer/)

### Schedulers
Linux is a multitasking operating system, and therefore, it has a scheduler to manage the processes. The Linux scheduler has evolved over time. 
With the Linux Kernerl 2.6, the O(1) scheduler came in. It relies on active and expired arrays of processes to achieve constant scheduling time. Each process is given a fixed time quantum, after which it is preempted and moved to the expired array. Once all the tasks from the active array have exhausted their time quantum and have been moved to the expired array, an array switch takes place. This switch makes the active array the new empty expired array, while the expired array becomes the active array. The main issue with this algorithm is the complex heuristics used to mark a task as interactive or non-interactive.

### The Completely Fair Scheduler
The Completely Fair Scheduler is a process scheduler that handles CPU resource allocation for executing processes and aims to maximize overall CPU utilization while also maximizing interactive performance. This was merged into the 2.6.23 (October 2007) release of the Linux kernel and is the default scheduler.

By "Completely Fair", the CFS Scheduler means to allocate the CPU resources equally and fairly among all the queued processes depending on their nice values.

The Completely Fair Scheduler uses a Red-Black tree to keep track of all the queued processes and handles switching with a nano second granularity. The fair queuing CFS scheduler has a scheduling complexity of `O(log N)`, where `N` is the number of tasks in the runqueue. Choosing a task can be done in constant time, but reinserting a task after it has run requires `O(log N)` operations, because the runqueue is implemented as a red-black tree. 

### The Visualizer
The CFS visualizer allows one to look at the process queue and the populated dynamic red-black tree while the scheduler is in action. The time scale has been magnified so that one can slow down and visualize the scheduler with nano-second granularity work in real time.

### Input format
The visualizer allows one to define custom processes which would be fed to the scheduler.  
However, the visualizer comes with a default config-
```
3 11
A 1 3 0
B 2 4 -2
C 2 3 2
```
which means that -
1. There are 3 processes and the processor would run for a maximum of 11 seconds
2. Process A starts at time `t = 1` and has a duration of 3 seconds, with it's nice `n = 0`
3. Process B starts at time `t = 2` and has a duration of 4 seconds, with it's nice `n = -2`
4. Process C starts at time `t = 2` and has a duration of 3 seconds, with it's nice `n = 2`


### Simulate
Hitting "Run Scheduler" would start the visualization and the CPU clock can be seen running. The current task is shown at the right, and all the queued tasks are shown in the red-black tree along with their virtual run times. A comprehensive log is generated at run time and can be accessed at the right. (The logging text box can be resized for a better width)

Finally, after the simulation is complete, a detailed report can be found that describes which process was running at which instance.
