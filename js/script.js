// =======================================================================
// Global Constants & State
// =======================================================================
const CONFIG = {
    GOAL_WATER: 2000,
    RECORD_COOLDOWN_MS: 5000,
    DEFAULT_HEIGHT: 1.75
};

const STATE = {
    currentUser: 'Me',
    logs: [], // Logs for current user
    allTodayLogs: [], // Logs for all users today
    todaySummary: {},
    yesterdaySummary: {}
};

// Data Definitions
const CONSTANTS = {
    DAILY_UNIQUE_TYPES: ['weight', 'sleep'],
    TYPE_NAMES: {
        weight: '体重记录',
        breakfast: '早餐',
        lunch: '午餐',
        dinner: '晚餐',
        fitness: '运动记录',
        water: '喝水记录',
        pee: '小便',
        poop: '大便',
        sleep: '睡眠记录',
        food_breakfast: '早餐',
        food_lunch: '午餐',
        food_dinner: '晚餐'
    },
    LOG_SORT_ORDER: {
        'weight': 10,
        'food_breakfast': 20,
        'food_lunch': 30,
        'food_dinner': 40,
        'fitness': 50,
        'water': 60,
        'pee': 70,
        'poop': 71,
        'sleep': 80
    },
    USER_MAP: { Me: '我', Wife: '老婆', Family: '家人' },
    USER_LABELS: { Me: '我', Wife: '老婆', Family: '家人' } // Can be customized for display
};

// =======================================================================
// Utility Functions
// =======================================================================
const Utils = {
    getFormattedDateString(date) {
        return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
            timeZone: 'Asia/Shanghai'
        });
    },

    getDateStr(date) {
        return date.toDateString();
    },

    getYesterday() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday;
    },

    calculateBMI(weight, height = CONFIG.DEFAULT_HEIGHT) {
        if (!weight || weight <= 0 || !height || height <= 0) return 'N/A';
        return (weight / (height * height)).toFixed(1);
    },

    getStorageKey(user) {
        return `healthLogs_${user}`;
    },

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
};

// =======================================================================
// Data Management
// =======================================================================
const DataManager = {
    loadLogsForUser(user) {
        try {
            const storedLogs = localStorage.getItem(Utils.getStorageKey(user));
            return storedLogs ? JSON.parse(storedLogs) : [];
        } catch (e) {
            console.error(`加载 ${user} 数据失败:`, e);
            UI.showNotification(`加载 ${user} 数据失败`, "error");
            return [];
        }
    },

    saveLogsForUser(user, logs) {
        try {
            localStorage.setItem(Utils.getStorageKey(user), JSON.stringify(logs));
        } catch (e) {
            console.error(`保存 ${user} 数据失败:`, e);
            UI.showNotification(`保存 ${user} 数据失败`, "error");
        }
    },

    addLog(user, type, val) {
        const logs = this.loadLogsForUser(user);
        const newLog = {
            id: Utils.generateId(),
            timestamp: Date.now(),
            type,
            val
        };
        logs.push(newLog);
        this.saveLogsForUser(user, logs);
        return logs;
    },

    // Load logs for a specific date across all users
    loadLogsForDate(targetDate) {
        const users = Object.keys(CONSTANTS.USER_MAP);
        const targetDateStr = Utils.getDateStr(targetDate);
        let mergedLogs = [];

        users.forEach(user => {
            const userLogs = this.loadLogsForUser(user);

            // Filter logs for the target date
            const dayUserLogs = userLogs.filter(log =>
                Utils.getDateStr(new Date(log.timestamp)) === targetDateStr
            );

            // Separate unique types (keep only latest) vs accumulative types
            const logsWithoutUnique = dayUserLogs.filter(log =>
                !CONSTANTS.DAILY_UNIQUE_TYPES.includes(log.type)
            );

            CONSTANTS.DAILY_UNIQUE_TYPES.forEach(type => {
                const latestLog = dayUserLogs
                    .filter(log => log.type === type)
                    .sort((a, b) => b.timestamp - a.timestamp)[0];

                if (latestLog) logsWithoutUnique.push(latestLog);
            });

            logsWithoutUnique.forEach(log => {
                mergedLogs.push({ ...log, originalUser: user });
            });
        });
        return mergedLogs;
    }
};

// =======================================================================
// UI & Rendering
// =======================================================================
const UI = {
    init() {
        this.bindEvents();
        this.updateDateTime();
        setInterval(() => this.updateDateTime(), 1000);
        this.render();
    },

    bindEvents() {
        // Event delegation or direct binding can go here
        // Most onclicks are currently in HTML, which we will refactor later if needed
    },

    updateDateTime() {
        const now = new Date();
        document.getElementById('currentDate').textContent = Utils.getFormattedDateString(now);
        document.getElementById('currentTime').textContent = now.toLocaleTimeString('zh-CN', { hour12: false });
    },

    switchUser(user) {
        STATE.currentUser = user;

        // Update Tabs
        document.querySelectorAll('.user-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.user === user);
        });

        // Update Section Headers
        ['Water', 'Weight', 'Sleep', 'Food', 'Body'].forEach(section => {
            const el = document.getElementById(`currentUserName_${section}`);
            if (el) el.textContent = CONSTANTS.USER_LABELS[user];
        });

        this.render();
    },

    render() {
        // Reload current user logs
        STATE.logs = DataManager.loadLogsForUser(STATE.currentUser);
        STATE.allTodayLogs = DataManager.loadLogsForDate(new Date());

        this.calculateSummaries();

        this.renderWater();
        this.renderFood();
        this.renderLogs();
        this.renderSummaryComparison();
    },

    calculateSummaries() {
        // Calculate summaries for today and yesterday for all users
        const users = Object.keys(CONSTANTS.USER_MAP);
        const todayLogs = DataManager.loadLogsForDate(new Date());
        const yesterdayLogs = DataManager.loadLogsForDate(Utils.getYesterday());

        STATE.todaySummary = {};
        STATE.yesterdaySummary = {};

        users.forEach(user => {
            STATE.todaySummary[user] = this.calculateDaySummary(todayLogs, user);
            STATE.yesterdaySummary[user] = this.calculateDaySummary(yesterdayLogs, user);
        });
    },

    calculateDaySummary(dayLogs, targetUser) {
        let summary = { waterSum: 0, calorieSum: 0, peeCount: 0, poopCount: 0, fitnessCount: 0 };

        dayLogs.filter(log => log.originalUser === targetUser).forEach(log => {
            if (log.type === 'water') summary.waterSum += log.val;
            else if (log.type === 'food' || log.type === 'fitness') summary.calorieSum += (log.val.calories || 0);
            else if (log.type === 'pee') summary.peeCount++;
            else if (log.type === 'poop') summary.poopCount++;
        });
        return summary;
    },

    renderWater() {
        // Calculate total water for current user today
        const todayStr = Utils.getDateStr(new Date());
        const todayWaterLogs = STATE.logs.filter(log =>
            log.type === 'water' && Utils.getDateStr(new Date(log.timestamp)) === todayStr
        );
        const totalWater = todayWaterLogs.reduce((sum, log) => sum + log.val, 0);

        document.getElementById('waterTotal').textContent = `${totalWater} ml`;

        const percentage = Math.min((totalWater / CONFIG.GOAL_WATER) * 100, 100);
        const progressBar = document.getElementById('waterBar');
        const progressText = document.getElementById('progressText');

        progressBar.style.width = `${percentage}%`;
        progressText.textContent = `${Math.round(percentage)}%`;
    },

    renderFood() {
        // Reset inputs
        ['breakfast', 'lunch', 'dinner'].forEach(meal => {
            const group = document.getElementById(`mealGroup_${meal}`);
            const display = document.getElementById(`display_${meal}`);
            const recordBtn = document.getElementById(`recordBtn_${meal}`);
            const editBtn = document.getElementById(`editBtn_${meal}`);

            // Check if meal is recorded today
            const todayStr = Utils.getDateStr(new Date());
            const mealLog = STATE.logs.find(log =>
                log.type === 'food' &&
                log.val.mealType === meal &&
                Utils.getDateStr(new Date(log.timestamp)) === todayStr
            );

            if (mealLog) {
                group.classList.add('recorded');
                display.style.display = 'block';
                display.innerHTML = `${mealLog.val.description} <span style="float:right; font-weight:bold;">${mealLog.val.calories} Kcal</span>`;
                recordBtn.style.display = 'none';
                editBtn.style.display = 'inline-flex';

                // Fill inputs but disable them (via CSS)
                document.getElementById(`foodInput_${meal}`).value = mealLog.val.description;
                document.getElementById(`calorieInput_${meal}`).value = mealLog.val.calories;
            } else {
                group.classList.remove('recorded');
                display.style.display = 'none';
                recordBtn.style.display = 'inline-flex';
                editBtn.style.display = 'none';

                document.getElementById(`foodInput_${meal}`).value = '';
                document.getElementById(`calorieInput_${meal}`).value = '';
            }
        });

        // Calculate total calories
        const todayStr = Utils.getDateStr(new Date());
        const totalCalories = STATE.logs
            .filter(log => (log.type === 'food' || log.type === 'fitness') && Utils.getDateStr(new Date(log.timestamp)) === todayStr)
            .reduce((sum, log) => sum + (log.val.calories || 0), 0);

        document.getElementById('totalCalories').textContent = totalCalories;
    },

    renderLogs() {
        const list = document.getElementById('logList');
        list.innerHTML = '';

        const sortType = document.getElementById('logSort').value;
        let logsToRender = [...STATE.allTodayLogs];

        // Sorting Logic
        logsToRender.sort((a, b) => {
            if (sortType === 'time') return b.timestamp - a.timestamp;
            if (sortType === 'category') return (CONSTANTS.LOG_SORT_ORDER[a.type] || 99) - (CONSTANTS.LOG_SORT_ORDER[b.type] || 99);
            if (sortType === 'user_category') {
                const userDiff = (CONSTANTS.USER_MAP[a.originalUser] === STATE.currentUser ? 0 : 1) - (CONSTANTS.USER_MAP[b.originalUser] === STATE.currentUser ? 0 : 1);
                if (userDiff !== 0) return userDiff;
                return (CONSTANTS.LOG_SORT_ORDER[a.type] || 99) - (CONSTANTS.LOG_SORT_ORDER[b.type] || 99);
            }
            return 0;
        });

        logsToRender.forEach(log => {
            const li = document.createElement('li');
            li.className = 'log-item';

            const timeStr = new Date(log.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
            const userLabel = CONSTANTS.USER_LABELS[log.originalUser];

            let content = '';
            let icon = '';

            // Determine content based on type
            switch (log.type) {
                case 'water':
                    icon = '<i class="fas fa-tint" style="color:var(--water)"></i>';
                    content = `喝水 ${log.val}ml`;
                    break;
                case 'food':
                    icon = '<i class="fas fa-utensils" style="color:var(--food)"></i>';
                    const mealName = CONSTANTS.TYPE_NAMES[log.val.mealType] || log.val.mealType;
                    content = `${mealName}: ${log.val.description} (${log.val.calories} Kcal)`;
                    break;
                case 'fitness':
                    icon = '<i class="fas fa-dumbbell" style="color:var(--fitness)"></i>';
                    content = `${log.val.type} ${log.val.duration}分钟 (${log.val.calories} Kcal)`;
                    break;
                case 'weight':
                    icon = '<i class="fas fa-weight" style="color:var(--weight)"></i>';
                    content = `体重: ${log.val.weight}kg, 体脂: ${log.val.bodyFat}%`;
                    break;
                case 'sleep':
                    icon = '<i class="fas fa-moon" style="color:var(--sleep)"></i>';
                    content = `睡眠: ${log.val}`;
                    break;
                case 'pee':
                    icon = '<i class="fas fa-tint" style="color:var(--body)"></i>';
                    content = '记录小便';
                    break;
                case 'poop':
                    icon = '<i class="fas fa-poop" style="color:var(--body)"></i>';
                    content = '记录大便';
                    break;
            }

            li.innerHTML = `
                <div class="log-content">
                    <span class="log-user-tag" style="background-color: ${log.originalUser === 'Me' ? 'var(--primary)' : (log.originalUser === 'Wife' ? 'var(--sleep)' : 'var(--food)')}">${userLabel}</span>
                    ${icon}
                    <span>${content}</span>
                </div>
                <div class="log-time">
                    ${timeStr}
                    <div class="log-actions">
                        <i class="fas fa-clock log-edit" onclick="Actions.modifyLogTime('${log.originalUser}', ${log.timestamp})" title="修改时间"></i>
                        <i class="fas fa-trash-alt log-del" onclick="Actions.deleteLog('${log.originalUser}', ${log.timestamp})" title="删除"></i>
                    </div>
                </div>
            `;
            list.appendChild(li);
        });
    },

    renderSummaryComparison() {
        const container = document.getElementById('summaryComparison');
        container.innerHTML = '';

        const users = Object.keys(CONSTANTS.USER_MAP);

        users.forEach(user => {
            const today = STATE.todaySummary[user];
            // const yesterday = STATE.yesterdaySummary[user]; // Can be used for comparison arrows

            const div = document.createElement('div');
            div.className = 'summary-grid';
            div.style.marginBottom = '20px';
            if (user !== users[users.length - 1]) div.style.borderBottom = '1px solid var(--border)';
            div.style.paddingBottom = '10px';

            div.innerHTML = `
                <div style="grid-column: 1/-1; font-weight:bold; color:var(--text); margin-bottom:5px;">${CONSTANTS.USER_LABELS[user]}</div>
                <div class="summary-item water">
                    <strong>喝水</strong>
                    <span>${today.waterSum} ml</span>
                </div>
                <div class="summary-item calorie">
                    <strong>热量</strong>
                    <span>${today.calorieSum}</span>
                </div>
                <div class="summary-item count">
                    <strong>小便/大便</strong>
                    <span>${today.peeCount} / ${today.poopCount}</span>
                </div>
            `;
            container.appendChild(div);
        });
    },

    showNotification(message, type = "success") {
        const notification = document.getElementById('notification');
        const notificationText = document.getElementById('notificationText');

        notificationText.textContent = message;
        notification.className = `notification ${type}`;
        notification.classList.add('show');

        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
};

// =======================================================================
// User Actions
// =======================================================================
const Actions = {
    addRecord(type, val) {
        DataManager.addLog(STATE.currentUser, type, val);
        UI.showNotification(`已记录 ${CONSTANTS.TYPE_NAMES[type] || type}`);
        UI.render();
    },

    addMeal(mealType) {
        const foodInput = document.getElementById(`foodInput_${mealType}`);
        const calorieInput = document.getElementById(`calorieInput_${mealType}`);

        const description = foodInput.value.trim();
        const calories = parseInt(calorieInput.value) || 0;

        if (!description) {
            UI.showNotification("请输入食物内容", "error");
            return;
        }

        this.addRecord('food', { mealType, description, calories });
    },

    editMeal(mealType) {
        // Logic to delete today's meal log so it can be re-entered
        const todayStr = Utils.getDateStr(new Date());
        const logs = DataManager.loadLogsForUser(STATE.currentUser);

        const logIndex = logs.findIndex(log =>
            log.type === 'food' &&
            log.val.mealType === mealType &&
            Utils.getDateStr(new Date(log.timestamp)) === todayStr
        );

        if (logIndex !== -1) {
            logs.splice(logIndex, 1);
            DataManager.saveLogsForUser(STATE.currentUser, logs);
            UI.render(); // Re-render to show input fields again
        }
    },

    addWeight() {
        const weight = parseFloat(document.getElementById('weightInput').value);
        const bodyFat = parseFloat(document.getElementById('bodyFatInput').value);

        if (!weight) {
            UI.showNotification("请输入体重", "error");
            return;
        }

        const bmi = Utils.calculateBMI(weight);
        document.getElementById('bmiDisplay').textContent = `BMI: ${bmi}`;

        this.addRecord('weight', { weight, bodyFat, bmi });
    },

    addSleep() {
        const sleepTime = document.getElementById('sleepTime').value.trim();
        if (!sleepTime) {
            UI.showNotification("请输入睡眠时间", "error");
            return;
        }
        this.addRecord('sleep', sleepTime);
    },

    addFitness() {
        // Simple prompt for now, could be a modal
        const type = prompt("运动类型 (跑步, 走路等):", "跑步");
        if (!type) return;

        const duration = parseInt(prompt("时长 (分钟):", "30"));
        if (!duration) return;

        const calories = parseInt(prompt("消耗热量 (Kcal):", "200"));

        this.addRecord('fitness', { type, duration, calories });
    },

    deleteLog(user, timestamp) {
        if (!confirm("确定要删除这条记录吗?")) return;

        const logs = DataManager.loadLogsForUser(user);
        const index = logs.findIndex(log => log.timestamp === timestamp);

        if (index !== -1) {
            logs.splice(index, 1);
            DataManager.saveLogsForUser(user, logs);
            UI.showNotification("记录已删除");
            UI.render();
        }
    },

    modifyLogTime(user, timestamp) {
        const logs = DataManager.loadLogsForUser(user);
        const log = logs.find(l => l.timestamp === timestamp);
        if (!log) return;

        const dateObj = new Date(timestamp);
        const timeStr = dateObj.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });

        const newTime = prompt("输入新时间 (HH:MM):", timeStr);
        if (!newTime) return;

        const [hours, minutes] = newTime.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes)) {
            UI.showNotification("时间格式无效", "error");
            return;
        }

        dateObj.setHours(hours, minutes);
        log.timestamp = dateObj.getTime();

        // Re-sort logs just in case, though render handles it
        logs.sort((a, b) => a.timestamp - b.timestamp);

        DataManager.saveLogsForUser(user, logs);
        UI.showNotification("时间已更新");
        UI.render();
    },

    clearData() {
        if (confirm(`确定要清空 ${STATE.currentUser} 的所有数据吗? 此操作不可撤销。`)) {
            DataManager.saveLogsForUser(STATE.currentUser, []);
            UI.showNotification("数据已清空");
            UI.render();
        }
    },

    exportDataToCSV() {
        // Implementation similar to original but using DataManager
        const users = Object.keys(CONSTANTS.USER_MAP);
        let fullLogs = [];

        users.forEach(user => {
            const userLogs = DataManager.loadLogsForUser(user);
            userLogs.forEach(log => fullLogs.push({ ...log, originalUser: user }));
        });

        if (fullLogs.length === 0) {
            UI.showNotification("没有数据可导出", "error");
            return;
        }

        // ... CSV generation logic ...
        // Simplified for brevity, can copy full logic if needed
        let csvContent = "用户,日期,时间,类型,数值\n";
        fullLogs.forEach(log => {
            const date = new Date(log.timestamp);
            const userLabel = CONSTANTS.USER_LABELS[log.originalUser];
            csvContent += `${userLabel},${date.toLocaleDateString()},${date.toLocaleTimeString()},${CONSTANTS.TYPE_NAMES[log.type] || log.type},${JSON.stringify(log.val)}\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `health_logs_${Date.now()}.csv`;
        a.click();
    }
};

// Global Exposure for HTML onclick handlers
window.switchUser = UI.switchUser.bind(UI);
window.addRecord = Actions.addRecord.bind(Actions);
window.addMeal = Actions.addMeal.bind(Actions);
window.editMeal = Actions.editMeal.bind(Actions);
window.addWeight = Actions.addWeight.bind(Actions);
window.addSleep = Actions.addSleep.bind(Actions);
window.addFitness = Actions.addFitness.bind(Actions);
window.saveAndRender = UI.render.bind(UI); // For sort change
window.clearData = Actions.clearData.bind(Actions);
window.exportDataToCSV = Actions.exportDataToCSV.bind(Actions);
window.Actions = Actions; // Expose Actions for dynamic HTML generation

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    UI.init();
});
