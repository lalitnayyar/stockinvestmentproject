class TaskController {
    constructor(taskModel) {
        this.taskModel = taskModel;
    }

    async createTask(req, res) {
        try {
            const { name, description } = req.body;
            const timestamp = new Date().toISOString();
            await this.taskModel.createTask(name, description, timestamp);
            res.redirect('/');
        } catch (error) {
            res.status(500).send(error.message);
        }
    }

    async getTasks(req, res) {
        try {
            const tasks = await this.taskModel.getTasks();
            res.render('index', { tasks });
        } catch (error) {
            res.status(500).send(error.message);
        }
    }

    async printTasks(req, res) {
        try {
            const tasks = await this.taskModel.getTasks();
            res.render('print', { tasks });
        } catch (error) {
            res.status(500).send(error.message);
        }
    }
}

module.exports = TaskController;