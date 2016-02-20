System.register(['angular2/core'], function(exports_1) {
    var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
        var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
        if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
        else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
        return c > 3 && r && Object.defineProperty(target, key, r), r;
    };
    var __metadata = (this && this.__metadata) || function (k, v) {
        if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
    };
    var core_1;
    var TodoStore;
    return {
        setters:[
            function (core_1_1) {
                core_1 = core_1_1;
            }],
        execute: function() {
            TodoStore = (function () {
                function TodoStore() {
                    this.todos = JSON.parse(localStorage.getItem('angular2-todos') || '[]');
                }
                TodoStore.prototype.updateStore = function () {
                    localStorage.setItem('angular2-todos', JSON.stringify(this.todos));
                };
                TodoStore.prototype.getWithCompleted = function (completed) {
                    return this.todos.filter(function (todo) { return todo.completed === completed; });
                };
                TodoStore.prototype.allCompleted = function () {
                    return this.todos.length === this.getCompleted().length;
                };
                TodoStore.prototype.setAllTo = function (completed) {
                    this.todos.forEach(function (t) { return t.completed = completed; });
                    this.updateStore();
                };
                TodoStore.prototype.removeCompleted = function () {
                    this.todos = this.getWithCompleted(false);
                    this.updateStore();
                };
                TodoStore.prototype.getRemaining = function () {
                    return this.getWithCompleted(false);
                };
                TodoStore.prototype.getCompleted = function () {
                    return this.getWithCompleted(true);
                };
                TodoStore.prototype.toggleCompletion = function (todo) {
                    todo.completed = !todo.completed;
                    this.updateStore();
                };
                TodoStore.prototype.remove = function (todo) {
                    this.todos.splice(this.todos.indexOf(todo), 1);
                    this.updateStore();
                };
                TodoStore.prototype.add = function (title) {
                    var todo = {
                        title: title
                    };
                    this.todos.push(todo);
                    this.updateStore();
                };
                TodoStore = __decorate([
                    core_1.Injectable(), 
                    __metadata('design:paramtypes', [])
                ], TodoStore);
                return TodoStore;
            })();
            exports_1("TodoStore", TodoStore);
        }
    }
});
//# sourceMappingURL=store.js.map