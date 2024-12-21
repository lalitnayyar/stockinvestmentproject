class TaskController {
    constructor(taskModel) {
        this.taskModel = taskModel;
    }

    async createTask(req, res) {
        try {
            const taskData = req.body;
            const newTask = await this.taskModel.saveTask(taskData);
            res.status(201).json(newTask);
        } catch (error) {
            res.status(500).json({ message: 'Error creating task', error });
        }
    }

    async getTasks(req, res) {
        try {
            const tasks = await this.taskModel.fetchTasks();
            res.status(200).json(tasks);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching tasks', error });
        }
    }

    async updateTask(req, res) {
        try {
            const taskId = req.params.id;
            const updatedData = req.body;
            const updatedTask = await this.taskModel.updateTaskById(taskId, updatedData);
            res.status(200).json(updatedTask);
        } catch (error) {
            res.status(500).json({ message: 'Error updating task', error });
        }
    }

    async deleteTask(req, res) {
        try {
            const taskId = req.params.id;
            await this.taskModel.deleteTaskById(taskId);
            res.status(204).send();
        } catch (error) {
            res.status(500).json({ message: 'Error deleting task', error });
        }
    }

    getAllTasks(req, res) {
        // Your logic to get all tasks
        res.send('Get all tasks');
    }

    createTask(req, res) {
        // Your logic to create a task
        res.send('Create a task');
    }
}

module.exports = new TaskController();