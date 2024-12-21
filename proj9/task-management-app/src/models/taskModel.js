class TaskModel {
    constructor(db) {
        this.db = db;
    }

    saveTask(task) {
        return new Promise((resolve, reject) => {
            const sql = 'INSERT INTO tasks (title, description, status) VALUES (?, ?, ?)';
            this.db.run(sql, [task.title, task.description, task.status], function(err) {
                if (err) {
                    return reject(err);
                }
                resolve({ id: this.lastID, ...task });
            });
        });
    }

    fetchTasks() {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM tasks';
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    return reject(err);
                }
                resolve(rows);
            });
        });
    }

    updateTaskById(id, task) {
        return new Promise((resolve, reject) => {
            const sql = 'UPDATE tasks SET title = ?, description = ?, status = ? WHERE id = ?';
            this.db.run(sql, [task.title, task.description, task.status, id], function(err) {
                if (err) {
                    return reject(err);
                }
                resolve({ id, ...task });
            });
        });
    }

    deleteTaskById(id) {
        return new Promise((resolve, reject) => {
            const sql = 'DELETE FROM tasks WHERE id = ?';
            this.db.run(sql, id, function(err) {
                if (err) {
                    return reject(err);
                }
                resolve({ deletedId: id });
            });
        });
    }
}

module.exports = TaskModel;