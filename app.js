(function () {
  'use strict';

  var STORAGE_KEY = 'crewLedgerDataV1';
  var DEFAULT_CATEGORIES = ['制作人员', '制作筹备', '设备器材', '场景租赁', '置景', '道具', '服化', '演员', '餐饮', '差旅', '交通', '保险', '后期制作', '制片杂费', '备用金'];
  var DEFAULT_DEPARTMENTS = ['制片组', '导演组', '摄影组', '灯光组', '录音组', '美术组', '服化道', '演员组', '后期组', '宣传组'];
  var INCOME_CATEGORIES = ['赞助', '经费', '集资'];
  var PAYMENT_METHODS = ['微信', '支付宝', '现金', '银行卡', '其他'];
  var REIMBURSEMENT = ['无需报销', '待提交', '已报销'];
  var app = document.getElementById('app');
  var modal = document.getElementById('modal');
  var modalContent = document.getElementById('modalContent');
  var importInput = document.getElementById('importInput');
  var state = loadState();

  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function isoToday() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function newState() {
    return {
      projects: [],
      currentProjectId: null,
      screen: 'projects',
      tab: 'overview',
      scheduleMode: 'week',
      weekStart: dateKey(startOfWeek(new Date())),
      ledgerFilters: { q: '', category: '', payer: '', status: '', type: '' }
    };
  }

  function loadState() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Object.assign(newState(), saved || {});
    } catch (error) {
      return newState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      toast('存储空间不足，请减少票据照片或先导出备份');
    }
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function fmtMoney(value) {
    return '¥' + Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  }

  function fmtDate(value, short) {
    if (!value) return '未设置';
    var d = new Date(value + 'T00:00:00');
    if (isNaN(d)) return value;
    return short ? (d.getMonth() + 1) + '月' + d.getDate() + '日' : d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  function currentProject() {
    return state.projects.find(function (p) { return p.id === state.currentProjectId; }) || null;
  }

  function projectSpent(project) {
    return project.transactions.filter(function (t) { return t.type === 'expense'; }).reduce(function (sum, t) { return sum + Number(t.amount || 0); }, 0);
  }

  function projectIncome(project) {
    return project.transactions.filter(function (t) { return t.type === 'income'; }).reduce(function (sum, t) { return sum + Number(t.amount || 0); }, 0);
  }

  function categorySpent(project, category) {
    return project.transactions.filter(function (t) { return t.type === 'expense' && t.category === category; }).reduce(function (sum, t) { return sum + Number(t.amount || 0); }, 0);
  }

  function startOfWeek(date) {
    var d = new Date(date);
    d.setHours(0, 0, 0, 0);
    var day = d.getDay() || 7;
    d.setDate(d.getDate() - day + 1);
    return d;
  }

  function addDays(date, days) {
    var d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  function dateKey(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }

  function toast(message) {
    var el = document.getElementById('toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { el.classList.remove('show'); }, 2400);
  }

  function openModal(html) {
    modalContent.innerHTML = '<div class="modal-body">' + html + '</div>';
    modal.showModal();
  }

  function closeModal() {
    modal.close();
    modalContent.innerHTML = '';
  }

  function topbar(project) {
    return [
      '<header class="topbar"><div class="topbar-inner">',
      project ? '<button class="btn icon-btn btn-ghost" data-action="back-projects" aria-label="返回项目">‹</button>' : '',
      '<div class="brand"><div class="brand-mark">账</div><div class="brand-copy">',
      '<div class="brand-title">片场账本</div>',
      '<div class="brand-sub">' + (project ? esc(project.name) : '学生剧组制片工具') + '</div>',
      '</div></div>',
      '<div class="top-actions">',
      project ? '<button class="btn btn-primary" data-action="new-transaction">＋ 记一笔</button>' : '<button class="btn btn-primary" data-action="new-project">＋ 新建项目</button>',
      '</div></div></header>'
    ].join('');
  }

  function projectNav() {
    var items = [
      ['overview', '⌂', '概览'],
      ['ledger', '￥', '账目'],
      ['schedule', '□', '计划'],
      ['settings', '•••', '项目']
    ];
    return '<nav class="bottom-nav" aria-label="项目导航">' + items.map(function (item) {
      return '<button class="nav-item ' + (state.tab === item[0] ? 'active' : '') + '" data-action="tab" data-tab="' + item[0] + '"><span>' + item[1] + '</span><span>' + item[2] + '</span></button>';
    }).join('') + '</nav>';
  }

  function render() {
    var project = currentProject();
    if (state.screen === 'project' && project) {
      app.innerHTML = '<div class="app-shell">' + topbar(project) + projectNav() + '<main class="main">' + renderProject(project) + '</main></div>';
    } else {
      state.screen = 'projects';
      app.innerHTML = '<div class="app-shell">' + topbar(null) + '<main class="main">' + renderProjects() + '</main></div>';
    }
  }

  function renderProjects() {
    var active = state.projects.filter(function (p) { return !p.archived; });
    var archived = state.projects.filter(function (p) { return p.archived; });
    var html = [
      '<div class="page-head"><div><h1>我的短片</h1><p>每个项目独立管理预算、账目和制片计划。</p></div>',
      '<button class="btn btn-primary" data-action="new-project">＋ 新建项目</button></div>'
    ];
    if (!state.projects.length) {
      html.push('<section class="card empty"><div class="empty-visual">￥</div><h2>从第一部短片开始</h2><p>创建项目后，就可以设置预算、记录垫付款和票据，并安排从前期到后期的事务。</p><button class="btn btn-primary" data-action="new-project">创建短片项目</button></section>');
      return html.join('');
    }
    if (active.length) {
      html.push('<div class="project-grid">' + active.map(projectCard).join('') + '</div>');
    }
    if (archived.length) {
      html.push('<div class="section-head" style="margin-top:28px"><h2>已归档</h2><span class="muted">' + archived.length + ' 个项目</span></div>');
      html.push('<div class="project-grid">' + archived.map(projectCard).join('') + '</div>');
    }
    return html.join('');
  }

  function projectCard(project) {
    var spent = projectSpent(project);
    var remain = Number(project.totalBudget || 0) - spent;
    return [
      '<article class="card project-card ' + (project.archived ? 'archived' : '') + '" data-action="open-project" data-id="' + project.id + '">',
      '<div class="project-top"><h2 class="project-name">' + esc(project.name) + '</h2><span class="tag ' + (project.archived ? 'tag-orange' : '') + '">' + (project.archived ? '已归档' : '进行中') + '</span></div>',
      '<div class="project-dates">' + fmtDate(project.startDate, true) + '—' + fmtDate(project.endDate, true) + '</div>',
      '<div class="project-stats"><div class="mini-stat"><span>已花费</span><strong>' + fmtMoney(spent) + '</strong></div><div class="mini-stat"><span>剩余预算</span><strong>' + fmtMoney(remain) + '</strong></div></div>',
      '</article>'
    ].join('');
  }

  function renderProject(project) {
    if (state.tab === 'ledger') return renderLedger(project);
    if (state.tab === 'schedule') return renderSchedule(project);
    if (state.tab === 'settings') return renderSettings(project);
    return renderOverview(project);
  }

  function pageTitle(title, subtitle, action) {
    return '<div class="page-head"><div><h1>' + title + '</h1><p>' + subtitle + '</p></div>' + (action || '') + '</div>';
  }

  function renderOverview(project) {
    var spent = projectSpent(project);
    var remaining = Number(project.totalBudget || 0) - spent;
    var income = projectIncome(project);
    var recent = project.transactions.slice().sort(function (a, b) { return b.date.localeCompare(a.date); }).slice(0, 5);
    var todoToday = project.tasks.filter(function (t) { return t.date === isoToday() && t.status !== 'done'; });
    var settlements = settlementRows(project);
    return [
      pageTitle('项目概览', '预算、花费和待处理事项一目了然。', '<button class="btn" data-action="new-task">＋ 加事务</button>'),
      '<div class="metrics">',
      '<section class="card metric metric-main"><span class="metric-label">总预算</span><strong class="metric-value">' + fmtMoney(project.totalBudget) + '</strong><div class="metric-note">实际收入 ' + fmtMoney(income) + '</div></section>',
      '<section class="card metric"><span class="metric-label">已花费</span><strong class="metric-value">' + fmtMoney(spent) + '</strong><div class="metric-note">' + (project.totalBudget ? Math.round(spent / project.totalBudget * 100) : 0) + '% 预算已使用</div></section>',
      '<section class="card metric"><span class="metric-label">剩余预算</span><strong class="metric-value">' + fmtMoney(remaining) + '</strong><div class="metric-note">' + (remaining < 0 ? '当前已超出预算' : '可继续使用') + '</div></section>',
      '</div>',
      '<div class="two-col"><div class="card section"><div class="section-head"><h2>分类预算</h2><button class="btn" data-action="edit-budgets">管理预算</button></div>',
      renderCategoryProgress(project),
      '</div><div class="card section"><div class="section-head"><h2>今日事务</h2><span class="tag">' + todoToday.length + ' 项</span></div>',
      todoToday.length ? '<div class="list">' + todoToday.map(taskListRow).join('') + '</div>' : '<p class="muted">今天没有待办，拍摄顺利。</p>',
      '</div></div>',
      '<div class="two-col" style="margin-top:16px"><div class="card section"><div class="section-head"><h2>最近账目</h2><button class="btn" data-action="tab" data-tab="ledger">查看全部</button></div>',
      recent.length ? '<div class="list">' + recent.map(transactionListRow).join('') + '</div>' : '<p class="muted">还没有账目，点击右上角“记一笔”开始。</p>',
      '</div><div class="card section"><div class="section-head"><h2>垫付与结算</h2><span class="muted">按付款人</span></div>',
      settlements.length ? '<div class="list">' + settlements.slice(0, 6).map(function (row) {
        return '<div class="list-row"><div class="list-main"><div class="list-title">' + esc(row.name) + '</div><div class="list-meta">待报销 ' + fmtMoney(row.pending) + '</div></div><span class="amount">' + fmtMoney(row.total) + '</span></div>';
      }).join('') + '</div>' : '<p class="muted">录入付款人后，这里会自动汇总垫付款。</p>',
      '</div></div>'
    ].join('');
  }

  function renderCategoryProgress(project) {
    var rows = project.categories.filter(function (c) { return Number(c.budget || 0) > 0 || categorySpent(project, c.name) > 0; });
    if (!rows.length) return '<p class="muted">暂未设置分类预算。</p>';
    return rows.map(function (cat) {
      var spent = categorySpent(project, cat.name);
      var ratio = cat.budget ? Math.round(spent / cat.budget * 100) : 0;
      return '<div class="progress-row"><div class="progress-meta"><strong>' + esc(cat.name) + '</strong><span>' + fmtMoney(spent) + ' / ' + fmtMoney(cat.budget) + '</span></div><div class="progress-track"><div class="progress-fill ' + (ratio > 100 ? 'over' : '') + '" style="width:' + Math.min(ratio, 100) + '%"></div></div></div>';
    }).join('');
  }

  function taskListRow(task) {
    return '<div class="list-row"><input class="check" type="checkbox" data-action="toggle-task" data-id="' + task.id + '" ' + (task.status === 'done' ? 'checked' : '') + '><div class="list-main"><div class="list-title">' + esc(task.title) + '</div><div class="list-meta">' + esc(task.department) + ' · ' + fmtDate(task.date, true) + '</div></div><button class="btn icon-btn" data-action="edit-task" data-id="' + task.id + '">•••</button></div>';
  }

  function transactionListRow(tx) {
    return '<div class="list-row" data-action="edit-transaction" data-id="' + tx.id + '"><div class="list-main"><div class="list-title">' + esc(tx.description || tx.category) + '</div><div class="list-meta">' + fmtDate(tx.date, true) + ' · ' + esc(tx.category) + (tx.payer ? ' · ' + esc(tx.payer) : '') + '</div></div><span class="amount ' + tx.type + '">' + (tx.type === 'income' ? '+' : '−') + fmtMoney(tx.amount) + '</span></div>';
  }

  function settlementRows(project) {
    var map = {};
    project.transactions.filter(function (t) { return t.type === 'expense' && t.payer; }).forEach(function (t) {
      if (!map[t.payer]) map[t.payer] = { name: t.payer, total: 0, pending: 0, reimbursed: 0 };
      map[t.payer].total += Number(t.amount || 0);
      if (t.reimbursementStatus === '待提交') map[t.payer].pending += Number(t.amount || 0);
      if (t.reimbursementStatus === '已报销') map[t.payer].reimbursed += Number(t.amount || 0);
    });
    return Object.keys(map).map(function (key) { return map[key]; }).sort(function (a, b) { return b.total - a.total; });
  }

  function renderLedger(project) {
    var f = state.ledgerFilters;
    var rows = project.transactions.filter(function (t) {
      var q = f.q.toLowerCase();
      return (!f.type || t.type === f.type)
        && (!f.category || t.category === f.category)
        && (!f.payer || t.payer === f.payer)
        && (!f.status || t.reimbursementStatus === f.status)
        && (!q || [t.description, t.note, t.payee, t.payer].join(' ').toLowerCase().indexOf(q) >= 0);
    }).sort(function (a, b) { return b.date.localeCompare(a.date); });
    var categories = project.categories.map(function (c) { return c.name; }).concat(INCOME_CATEGORIES);
    return [
      pageTitle('账目', '记录收入、支出、票据和报销状态。', '<button class="btn btn-primary" data-action="new-transaction">＋ 记一笔</button>'),
      '<section class="card section"><div class="toolbar">',
      '<div class="field"><input class="input" data-filter="q" value="' + esc(f.q) + '" placeholder="搜索说明、人员或备注"></div>',
      '<div class="field"><select data-filter="type"><option value="">全部类型</option><option value="expense" ' + (f.type === 'expense' ? 'selected' : '') + '>支出</option><option value="income" ' + (f.type === 'income' ? 'selected' : '') + '>收入</option></select></div>',
      '<div class="field"><select data-filter="category"><option value="">全部分类</option>' + categories.map(function (c) { return '<option ' + (f.category === c ? 'selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></div>',
      '<div class="field"><select data-filter="payer"><option value="">全部付款人</option>' + project.contacts.payers.map(function (c) { return '<option ' + (f.payer === c ? 'selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></div>',
      '<div class="field"><select data-filter="status"><option value="">全部报销状态</option>' + REIMBURSEMENT.map(function (s) { return '<option ' + (f.status === s ? 'selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div>',
      '</div>',
      rows.length ? '<div class="table-wrap"><table><thead><tr><th>日期</th><th>说明</th><th>分类</th><th>付款人</th><th>报销</th><th>金额</th><th></th></tr></thead><tbody>' + rows.map(function (tx) {
        return '<tr><td>' + esc(tx.date) + '</td><td><strong>' + esc(tx.description || '未填写') + '</strong>' + (tx.receipts && tx.receipts.length ? '<div class="list-meta">' + tx.receipts.length + ' 张票据</div>' : '') + '</td><td>' + esc(tx.category) + '</td><td>' + esc(tx.payer || '—') + '</td><td>' + esc(tx.reimbursementStatus || '—') + '</td><td class="amount ' + tx.type + '">' + (tx.type === 'income' ? '+' : '−') + fmtMoney(tx.amount) + '</td><td><div class="row-actions"><button data-action="edit-transaction" data-id="' + tx.id + '">编辑</button></div></td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="empty"><h2>没有符合条件的账目</h2><p>调整筛选条件，或者新增一笔收支。</p></div>',
      '</section>'
    ].join('');
  }

  function renderSchedule(project) {
    return [
      pageTitle('制片计划', '按部门和日期安排从前期到后期的事务。', '<button class="btn btn-primary" data-action="new-task">＋ 加事务</button>'),
      '<div class="tabs"><button class="tab ' + (state.scheduleMode === 'week' ? 'active' : '') + '" data-action="schedule-mode" data-mode="week">周事务表</button><button class="tab ' + (state.scheduleMode === 'timeline' ? 'active' : '') + '" data-action="schedule-mode" data-mode="timeline">时间总表</button></div>',
      state.scheduleMode === 'timeline' ? renderTimeline(project) : renderWeek(project)
    ].join('');
  }

  function renderWeek(project) {
    var start = new Date(state.weekStart + 'T00:00:00');
    var days = Array.from({ length: 7 }, function (_, i) { return addDays(start, i); });
    var headers = '<div class="cal-cell cal-head cal-dept">部门</div>' + days.map(function (d) {
      var key = dateKey(d);
      return '<div class="cal-cell cal-head ' + (key === isoToday() ? 'today' : '') + '">' + ['日', '一', '二', '三', '四', '五', '六'][d.getDay()] + '<br><strong>' + (d.getMonth() + 1) + '/' + d.getDate() + '</strong></div>';
    }).join('');
    var body = project.departments.map(function (dept) {
      return '<div class="cal-cell cal-dept">' + esc(dept) + '</div>' + days.map(function (d) {
        var key = dateKey(d);
        var tasks = project.tasks.filter(function (t) { return t.department === dept && t.date === key; });
        return '<div class="cal-cell">' + tasks.map(function (task) {
          return '<button class="task-chip ' + (task.status === 'done' ? 'done' : '') + '" data-action="edit-task" data-id="' + task.id + '">' + esc(task.title) + '</button>';
        }).join('') + '<button class="btn btn-ghost" style="min-height:28px;padding:3px 7px;font-size:.74rem" data-action="new-task-date" data-date="' + key + '" data-dept="' + esc(dept) + '">＋</button></div>';
      }).join('');
    }).join('');
    return '<section class="card section"><div class="week-controls"><button class="btn icon-btn" data-action="week-prev">‹</button><div class="week-label">' + fmtDate(dateKey(days[0]), true) + '—' + fmtDate(dateKey(days[6]), true) + '</div><button class="btn icon-btn" data-action="week-next">›</button></div><div class="calendar"><div class="calendar-grid">' + headers + body + '</div></div></section>';
  }

  function renderTimeline(project) {
    var tasks = project.tasks.slice().sort(function (a, b) { return a.date.localeCompare(b.date) || a.department.localeCompare(b.department); });
    return '<section class="card section">' + (tasks.length ? '<div class="timeline">' + tasks.map(function (task) {
      return '<div class="timeline-row"><div class="timeline-date">' + fmtDate(task.date, true) + '</div><div><strong>' + esc(task.title) + '</strong><div class="list-meta">' + esc(task.department) + '</div></div><input class="check" type="checkbox" data-action="toggle-task" data-id="' + task.id + '" ' + (task.status === 'done' ? 'checked' : '') + '></div>';
    }).join('') + '</div>' : '<div class="empty"><h2>还没有制片事务</h2><p>添加事务后，它们会按日期排列在总表里。</p><button class="btn btn-primary" data-action="new-task">添加事务</button></div>') + '</section>';
  }

  function renderSettings(project) {
    return [
      pageTitle('项目设置', '管理项目资料、模板和数据。', ''),
      '<div class="settings-grid">',
      '<section class="card section"><div class="section-head"><h2>项目资料</h2><button class="btn" data-action="edit-project" data-id="' + project.id + '">编辑</button></div><div class="list">',
      '<div class="list-row"><div class="list-main"><div class="list-title">项目周期</div><div class="list-meta">' + fmtDate(project.startDate) + '—' + fmtDate(project.endDate) + '</div></div></div>',
      '<div class="list-row"><div class="list-main"><div class="list-title">总预算</div><div class="list-meta">' + fmtMoney(project.totalBudget) + '</div></div></div>',
      '<div class="list-row"><div class="list-main"><div class="list-title">状态</div><div class="list-meta">' + (project.archived ? '已归档' : '进行中') + '</div></div><button class="btn" data-action="toggle-archive">' + (project.archived ? '取消归档' : '归档项目') + '</button></div>',
      '</div></section>',
      '<section class="card section"><div class="section-head"><h2>预算与分类</h2><button class="btn" data-action="edit-budgets">管理</button></div><p class="muted">共 ' + project.categories.length + ' 个支出分类，可为每类分别设置预算。</p><div class="notice">分类预算之和可以与总预算不同，方便保留机动空间。</div></section>',
      '<section class="card section"><div class="section-head"><h2>计划部门</h2><button class="btn" data-action="edit-departments">管理</button></div><p class="muted">' + project.departments.map(esc).join('、') + '</p></section>',
      '<section class="card section"><div class="section-head"><h2>常用人员</h2><button class="btn" data-action="edit-contacts">管理</button></div><p class="muted">付款人 ' + project.contacts.payers.length + ' 位，收款方 ' + project.contacts.payees.length + ' 位。</p></section>',
      '<section class="card section"><div class="section-head"><h2>提醒</h2><button class="btn" data-action="enable-notifications">开启通知</button></div><p class="muted">事务当天在打开网站时提醒。安装到桌面后使用更方便。</p></section>',
      '<section class="card section"><div class="section-head"><h2>导出与备份</h2></div><div class="list"><button class="btn" data-action="export-excel">导出 Excel</button><button class="btn" data-action="export-pdf">导出 PDF</button><button class="btn" data-action="export-backup">导出数据备份</button><button class="btn" data-action="import-backup">导入数据备份</button></div></section>',
      '<section class="card section danger-zone"><div class="section-head"><h2>删除项目</h2></div><p class="muted">删除后无法恢复，建议先导出数据备份。</p><button class="btn btn-danger" data-action="delete-project">删除这个项目</button></section>',
      '</div>'
    ].join('');
  }

  function openProjectForm(project) {
    var editing = !!project;
    openModal([
      '<div class="modal-head"><h2>' + (editing ? '编辑项目' : '新建短片项目') + '</h2><button class="close-btn" data-action="close-modal">×</button></div>',
      '<form id="projectForm"><div class="form-grid">',
      '<div class="field full"><label>项目名称</label><input name="name" required maxlength="40" value="' + esc(project ? project.name : '') + '" placeholder="例如：毕业短片《海风》"></div>',
      '<div class="field"><label>开始日期</label><input type="date" name="startDate" required value="' + esc(project ? project.startDate : isoToday()) + '"></div>',
      '<div class="field"><label>结束日期</label><input type="date" name="endDate" required value="' + esc(project ? project.endDate : isoToday()) + '"></div>',
      '<div class="field full"><label>总预算（元）</label><input type="number" name="totalBudget" min="0" step="0.01" value="' + esc(project ? project.totalBudget : '') + '" placeholder="0"></div>',
      '</div><div class="form-actions"><button type="button" class="btn" data-action="close-modal">取消</button><button class="btn btn-primary" type="submit">保存项目</button></div></form>'
    ].join(''));
    document.getElementById('projectForm').addEventListener('submit', function (event) {
      event.preventDefault();
      var fd = new FormData(event.currentTarget);
      if (editing) {
        project.name = fd.get('name').trim();
        project.startDate = fd.get('startDate');
        project.endDate = fd.get('endDate');
        project.totalBudget = Number(fd.get('totalBudget') || 0);
      } else {
        var created = {
          id: uid('project'),
          name: fd.get('name').trim(),
          startDate: fd.get('startDate'),
          endDate: fd.get('endDate'),
          totalBudget: Number(fd.get('totalBudget') || 0),
          archived: false,
          categories: DEFAULT_CATEGORIES.map(function (name) { return { id: uid('cat'), name: name, budget: 0 }; }),
          departments: DEFAULT_DEPARTMENTS.slice(),
          contacts: { payers: [], payees: [] },
          transactions: [],
          tasks: []
        };
        state.projects.push(created);
        state.currentProjectId = created.id;
        state.screen = 'project';
        state.tab = 'overview';
      }
      saveState();
      closeModal();
      render();
      toast('项目已保存');
    });
  }

  function openTransactionForm(id, presetType) {
    var project = currentProject();
    var tx = project.transactions.find(function (t) { return t.id === id; });
    var editing = !!tx;
    var type = tx ? tx.type : (presetType || 'expense');
    var existingReceipts = tx && tx.receipts ? tx.receipts : [];
    function formHtml(selectedType) {
      var categories = selectedType === 'income' ? INCOME_CATEGORIES : project.categories.map(function (c) { return c.name; });
      return [
        '<div class="modal-head"><h2>' + (editing ? '编辑账目' : '记一笔') + '</h2><button class="close-btn" data-action="close-modal">×</button></div>',
        '<div class="segmented" style="margin-bottom:18px"><button type="button" class="' + (selectedType === 'expense' ? 'active' : '') + '" data-action="transaction-type" data-type="expense">支出</button><button type="button" class="' + (selectedType === 'income' ? 'active' : '') + '" data-action="transaction-type" data-type="income">收入</button></div>',
        '<form id="transactionForm" data-type="' + selectedType + '"><div class="form-grid">',
        '<div class="field"><label>日期</label><input type="date" name="date" required value="' + esc(tx ? tx.date : isoToday()) + '"></div>',
        '<div class="field"><label>金额（元）</label><input type="number" name="amount" min="0" step="0.01" required value="' + esc(tx ? tx.amount : '') + '" placeholder="0"></div>',
        '<div class="field"><label>分类</label><select name="category" required>' + categories.map(function (c) { return '<option ' + (tx && tx.category === c ? 'selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></div>',
        '<div class="field"><label>说明</label><input name="description" maxlength="80" value="' + esc(tx ? tx.description : '') + '" placeholder="' + (selectedType === 'income' ? '例如：学院拍摄经费' : '例如：拍摄日盒饭') + '"></div>',
        selectedType === 'expense' ? [
          '<div class="field"><label>付款人</label><input name="payer" list="payerList" value="' + esc(tx ? tx.payer : '') + '" placeholder="谁先垫付"><datalist id="payerList">' + project.contacts.payers.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</datalist></div>',
          '<div class="field"><label>收款方</label><input name="payee" list="payeeList" value="' + esc(tx ? tx.payee : '') + '" placeholder="商家或个人"><datalist id="payeeList">' + project.contacts.payees.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</datalist></div>',
          '<div class="field"><label>支付方式</label><select name="paymentMethod">' + PAYMENT_METHODS.map(function (m) { return '<option ' + (tx && tx.paymentMethod === m ? 'selected' : '') + '>' + m + '</option>'; }).join('') + '</select></div>',
          '<div class="field"><label>报销状态</label><select name="reimbursementStatus">' + REIMBURSEMENT.map(function (s) { return '<option ' + (tx && tx.reimbursementStatus === s ? 'selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div>',
          '<div class="field full"><label>票据照片（可多选）</label><input type="file" name="receipts" accept="image/*" multiple><div class="receipt-preview">' + existingReceipts.map(function (src) { return '<img src="' + src + '" alt="票据">'; }).join('') + '</div></div>'
        ].join('') : '',
        '<div class="field full"><label>备注</label><textarea name="note" placeholder="可选">' + esc(tx ? tx.note : '') + '</textarea></div>',
        '</div><div class="form-actions">' + (editing ? '<button type="button" class="btn btn-danger" data-action="delete-transaction" data-id="' + tx.id + '">删除</button>' : '') + '<button type="button" class="btn" data-action="close-modal">取消</button><button class="btn btn-primary" type="submit">保存账目</button></div></form>'
      ].join('');
    }
    openModal(formHtml(type));
    bindTransactionForm();
    function bindTransactionForm() {
      document.getElementById('transactionForm').addEventListener('submit', async function (event) {
        event.preventDefault();
        var form = event.currentTarget;
        var fd = new FormData(form);
        var payer = String(fd.get('payer') || '').trim();
        var payee = String(fd.get('payee') || '').trim();
        var files = Array.from(form.elements.receipts ? form.elements.receipts.files : []);
        var addedReceipts = [];
        for (var i = 0; i < files.length; i += 1) addedReceipts.push(await compressImage(files[i]));
        var record = {
          id: editing ? tx.id : uid('tx'),
          type: form.dataset.type,
          date: fd.get('date'),
          amount: Number(fd.get('amount') || 0),
          category: fd.get('category'),
          description: String(fd.get('description') || '').trim(),
          payer: payer,
          payee: payee,
          paymentMethod: String(fd.get('paymentMethod') || ''),
          reimbursementStatus: String(fd.get('reimbursementStatus') || ''),
          note: String(fd.get('note') || '').trim(),
          receipts: existingReceipts.concat(addedReceipts)
        };
        if (editing) Object.assign(tx, record); else project.transactions.push(record);
        if (payer && project.contacts.payers.indexOf(payer) < 0) project.contacts.payers.push(payer);
        if (payee && project.contacts.payees.indexOf(payee) < 0) project.contacts.payees.push(payee);
        saveState();
        closeModal();
        render();
        toast('账目已保存');
      });
    }
    modalContent.addEventListener('click', function switchType(event) {
      var btn = event.target.closest('[data-action="transaction-type"]');
      if (!btn) return;
      type = btn.dataset.type;
      modalContent.innerHTML = '<div class="modal-body">' + formHtml(type) + '</div>';
      bindTransactionForm();
    }, { once: false });
  }

  function compressImage(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var image = new Image();
        image.onload = function () {
          var max = 1400;
          var scale = Math.min(1, max / Math.max(image.width, image.height));
          var canvas = document.createElement('canvas');
          canvas.width = Math.round(image.width * scale);
          canvas.height = Math.round(image.height * scale);
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', .72));
        };
        image.onerror = reject;
        image.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function openTaskForm(id, date, dept) {
    var project = currentProject();
    var task = project.tasks.find(function (t) { return t.id === id; });
    openModal([
      '<div class="modal-head"><h2>' + (task ? '编辑事务' : '添加事务') + '</h2><button class="close-btn" data-action="close-modal">×</button></div>',
      '<form id="taskForm"><div class="form-grid">',
      '<div class="field full"><label>事务</label><input name="title" required maxlength="80" value="' + esc(task ? task.title : '') + '" placeholder="例如：确认演员通告"></div>',
      '<div class="field"><label>日期</label><input type="date" name="date" required value="' + esc(task ? task.date : (date || isoToday())) + '"></div>',
      '<div class="field"><label>部门</label><select name="department">' + project.departments.map(function (d) { return '<option ' + ((task ? task.department : dept) === d ? 'selected' : '') + '>' + esc(d) + '</option>'; }).join('') + '</select></div>',
      '<div class="field full"><label>状态</label><select name="status"><option value="todo" ' + (!task || task.status === 'todo' ? 'selected' : '') + '>待办</option><option value="done" ' + (task && task.status === 'done' ? 'selected' : '') + '>完成</option></select></div>',
      '</div><div class="form-actions">' + (task ? '<button type="button" class="btn btn-danger" data-action="delete-task" data-id="' + task.id + '">删除</button>' : '') + '<button type="button" class="btn" data-action="close-modal">取消</button><button class="btn btn-primary" type="submit">保存事务</button></div></form>'
    ].join(''));
    document.getElementById('taskForm').addEventListener('submit', function (event) {
      event.preventDefault();
      var fd = new FormData(event.currentTarget);
      var record = { id: task ? task.id : uid('task'), title: fd.get('title').trim(), date: fd.get('date'), department: fd.get('department'), status: fd.get('status') };
      if (task) Object.assign(task, record); else project.tasks.push(record);
      saveState();
      closeModal();
      render();
      toast('事务已保存');
    });
  }

  function openBudgetEditor() {
    var project = currentProject();
    function rows() {
      return project.categories.map(function (c) {
        return '<div class="budget-line" data-category-row data-id="' + c.id + '"><input class="input category-name" value="' + esc(c.name) + '"><input class="input category-budget" type="number" min="0" step="0.01" value="' + Number(c.budget || 0) + '" placeholder="预算"><button type="button" class="btn icon-btn btn-danger" data-action="remove-category">×</button></div>';
      }).join('');
    }
    openModal('<div class="modal-head"><h2>分类预算</h2><button class="close-btn" data-action="close-modal">×</button></div><form id="budgetForm"><div class="budget-editor" id="budgetRows">' + rows() + '</div><button type="button" class="btn" style="margin-top:12px" data-action="add-category">＋ 添加分类</button><div class="form-actions"><button type="button" class="btn" data-action="close-modal">取消</button><button class="btn btn-primary" type="submit">保存分类预算</button></div></form>');
    document.getElementById('budgetForm').addEventListener('submit', function (event) {
      event.preventDefault();
      project.categories = Array.from(document.querySelectorAll('[data-category-row]')).map(function (row) {
        return { id: row.dataset.id || uid('cat'), name: row.querySelector('.category-name').value.trim(), budget: Number(row.querySelector('.category-budget').value || 0) };
      }).filter(function (c) { return c.name; });
      saveState();
      closeModal();
      render();
      toast('分类预算已更新');
    });
  }

  function openListEditor(kind) {
    var project = currentProject();
    var isDept = kind === 'departments';
    var list = isDept ? project.departments : [];
    var payers = project.contacts.payers.slice();
    var payees = project.contacts.payees.slice();
    var html = '<div class="modal-head"><h2>' + (isDept ? '计划部门' : '常用人员') + '</h2><button class="close-btn" data-action="close-modal">×</button></div><form id="listForm">';
    if (isDept) {
      html += '<div class="field"><label>每行一个部门</label><textarea name="departments" style="min-height:260px">' + esc(list.join('\n')) + '</textarea></div>';
    } else {
      html += '<div class="form-grid"><div class="field"><label>付款人，每行一个</label><textarea name="payers" style="min-height:220px">' + esc(payers.join('\n')) + '</textarea></div><div class="field"><label>收款方，每行一个</label><textarea name="payees" style="min-height:220px">' + esc(payees.join('\n')) + '</textarea></div></div>';
    }
    html += '<div class="form-actions"><button type="button" class="btn" data-action="close-modal">取消</button><button class="btn btn-primary" type="submit">保存</button></div></form>';
    openModal(html);
    document.getElementById('listForm').addEventListener('submit', function (event) {
      event.preventDefault();
      var fd = new FormData(event.currentTarget);
      function lines(value) { return String(value || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean); }
      if (isDept) project.departments = lines(fd.get('departments'));
      else project.contacts = { payers: lines(fd.get('payers')), payees: lines(fd.get('payees')) };
      saveState();
      closeModal();
      render();
      toast('已更新');
    });
  }

  function download(name, content, type) {
    var blob = new Blob([content], { type: type || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function exportExcel(project) {
    var txRows = project.transactions.slice().sort(function (a, b) { return a.date.localeCompare(b.date); }).map(function (t) {
      return '<tr><td>' + esc(t.date) + '</td><td>' + (t.type === 'income' ? '收入' : '支出') + '</td><td>' + esc(t.category) + '</td><td>' + esc(t.description) + '</td><td>' + Number(t.amount || 0) + '</td><td>' + esc(t.payer) + '</td><td>' + esc(t.payee) + '</td><td>' + esc(t.paymentMethod) + '</td><td>' + esc(t.reimbursementStatus) + '</td><td>' + esc(t.note) + '</td></tr>';
    }).join('');
    var budgetRows = project.categories.map(function (c) {
      var spent = categorySpent(project, c.name);
      return '<tr><td>' + esc(c.name) + '</td><td>' + Number(c.budget || 0) + '</td><td>' + spent + '</td><td>' + (Number(c.budget || 0) - spent) + '</td></tr>';
    }).join('');
    var settlement = settlementRows(project).map(function (r) {
      return '<tr><td>' + esc(r.name) + '</td><td>' + r.total + '</td><td>' + r.pending + '</td><td>' + r.reimbursed + '</td></tr>';
    }).join('');
    var html = '\ufeff<html><head><meta charset="utf-8"></head><body><h1>' + esc(project.name) + ' 制片结算表</h1><p>总预算：' + project.totalBudget + '　已花费：' + projectSpent(project) + '　剩余预算：' + (project.totalBudget - projectSpent(project)) + '</p><h2>分类预算</h2><table border="1"><tr><th>分类</th><th>预算</th><th>实际花费</th><th>剩余</th></tr>' + budgetRows + '</table><h2>付款人结算</h2><table border="1"><tr><th>付款人</th><th>垫付总额</th><th>待报销</th><th>已报销</th></tr>' + settlement + '</table><h2>账目明细</h2><table border="1"><tr><th>日期</th><th>类型</th><th>分类</th><th>说明</th><th>金额</th><th>付款人</th><th>收款方</th><th>支付方式</th><th>报销状态</th><th>备注</th></tr>' + txRows + '</table></body></html>';
    download(project.name + '-制片结算表.xls', html, 'application/vnd.ms-excel;charset=utf-8');
    toast('Excel 已导出');
  }

  function exportPdf(project) {
    var win = window.open('', '_blank');
    if (!win) { toast('浏览器拦截了打印窗口，请允许弹窗'); return; }
    var transactions = project.transactions.slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
    win.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + esc(project.name) + ' 制片结算表</title><style>body{font-family:system-ui,sans-serif;color:#18221d;padding:24px}h1{margin:0 0 6px}p{color:#66736c}table{width:100%;border-collapse:collapse;margin:16px 0 28px}th,td{border:1px solid #ccd6d0;padding:7px;text-align:left;font-size:12px}.metrics{display:flex;gap:12px}.metric{border:1px solid #ccd6d0;padding:12px;min-width:140px}.metric b{display:block;font-size:20px;margin-top:5px}@page{size:A4;margin:14mm}</style></head><body><h1>' + esc(project.name) + ' 制片结算表</h1><p>' + fmtDate(project.startDate) + '—' + fmtDate(project.endDate) + '</p><div class="metrics"><div class="metric">总预算<b>' + fmtMoney(project.totalBudget) + '</b></div><div class="metric">已花费<b>' + fmtMoney(projectSpent(project)) + '</b></div><div class="metric">剩余预算<b>' + fmtMoney(project.totalBudget - projectSpent(project)) + '</b></div></div><h2>分类预算</h2><table><tr><th>分类</th><th>预算</th><th>实际花费</th><th>剩余</th></tr>' + project.categories.map(function (c) { var spent = categorySpent(project, c.name); return '<tr><td>' + esc(c.name) + '</td><td>' + fmtMoney(c.budget) + '</td><td>' + fmtMoney(spent) + '</td><td>' + fmtMoney(c.budget - spent) + '</td></tr>'; }).join('') + '</table><h2>付款人结算</h2><table><tr><th>付款人</th><th>垫付总额</th><th>待报销</th><th>已报销</th></tr>' + settlementRows(project).map(function (r) { return '<tr><td>' + esc(r.name) + '</td><td>' + fmtMoney(r.total) + '</td><td>' + fmtMoney(r.pending) + '</td><td>' + fmtMoney(r.reimbursed) + '</td></tr>'; }).join('') + '</table><h2>账目明细</h2><table><tr><th>日期</th><th>分类</th><th>说明</th><th>付款人</th><th>报销</th><th>金额</th></tr>' + transactions.map(function (t) { return '<tr><td>' + esc(t.date) + '</td><td>' + esc(t.category) + '</td><td>' + esc(t.description) + '</td><td>' + esc(t.payer || '—') + '</td><td>' + esc(t.reimbursementStatus || '—') + '</td><td>' + (t.type === 'income' ? '+' : '−') + fmtMoney(t.amount) + '</td></tr>'; }).join('') + '</table></body></html>');
    win.document.close();
    setTimeout(function () { win.print(); }, 350);
  }

  function checkTodayNotifications() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    var today = isoToday();
    var marker = 'crewLedgerNotified_' + today;
    if (localStorage.getItem(marker)) return;
    var tasks = [];
    state.projects.filter(function (p) { return !p.archived; }).forEach(function (p) {
      p.tasks.filter(function (t) { return t.date === today && t.status !== 'done'; }).forEach(function (t) { tasks.push(p.name + ' · ' + t.title); });
    });
    if (tasks.length) {
      new Notification('片场账本：今天有 ' + tasks.length + ' 项待办', { body: tasks.slice(0, 3).join('\n'), icon: './icon.svg' });
      localStorage.setItem(marker, '1');
    }
  }

  document.addEventListener('click', function (event) {
    var el = event.target.closest('[data-action]');
    if (!el) return;
    var action = el.dataset.action;
    var project = currentProject();
    if (action === 'new-project') openProjectForm(null);
    if (action === 'edit-project') openProjectForm(project);
    if (action === 'open-project') { state.currentProjectId = el.dataset.id; state.screen = 'project'; state.tab = 'overview'; saveState(); render(); }
    if (action === 'back-projects') { state.screen = 'projects'; saveState(); render(); }
    if (action === 'tab') { state.tab = el.dataset.tab; saveState(); render(); }
    if (action === 'close-modal') closeModal();
    if (action === 'new-transaction') openTransactionForm(null, 'expense');
    if (action === 'edit-transaction') openTransactionForm(el.dataset.id);
    if (action === 'delete-transaction') {
      if (confirm('确定删除这笔账目吗？')) { project.transactions = project.transactions.filter(function (t) { return t.id !== el.dataset.id; }); saveState(); closeModal(); render(); toast('账目已删除'); }
    }
    if (action === 'new-task') openTaskForm(null);
    if (action === 'new-task-date') openTaskForm(null, el.dataset.date, el.dataset.dept);
    if (action === 'edit-task') openTaskForm(el.dataset.id);
    if (action === 'delete-task') {
      if (confirm('确定删除这条事务吗？')) { project.tasks = project.tasks.filter(function (t) { return t.id !== el.dataset.id; }); saveState(); closeModal(); render(); }
    }
    if (action === 'toggle-task') {
      var task = project.tasks.find(function (t) { return t.id === el.dataset.id; });
      if (task) { task.status = el.checked ? 'done' : 'todo'; saveState(); render(); }
    }
    if (action === 'week-prev' || action === 'week-next') {
      var days = action === 'week-prev' ? -7 : 7;
      state.weekStart = dateKey(addDays(new Date(state.weekStart + 'T00:00:00'), days));
      saveState(); render();
    }
    if (action === 'schedule-mode') { state.scheduleMode = el.dataset.mode; saveState(); render(); }
    if (action === 'edit-budgets') openBudgetEditor();
    if (action === 'add-category') {
      document.getElementById('budgetRows').insertAdjacentHTML('beforeend', '<div class="budget-line" data-category-row data-id=""><input class="input category-name" placeholder="分类名称"><input class="input category-budget" type="number" min="0" step="0.01" placeholder="预算"><button type="button" class="btn icon-btn btn-danger" data-action="remove-category">×</button></div>');
    }
    if (action === 'remove-category') el.closest('[data-category-row]').remove();
    if (action === 'edit-departments') openListEditor('departments');
    if (action === 'edit-contacts') openListEditor('contacts');
    if (action === 'toggle-archive') { project.archived = !project.archived; saveState(); render(); toast(project.archived ? '项目已归档' : '项目已恢复'); }
    if (action === 'delete-project') {
      if (confirm('确定永久删除“' + project.name + '”吗？此操作无法恢复。')) { state.projects = state.projects.filter(function (p) { return p.id !== project.id; }); state.currentProjectId = null; state.screen = 'projects'; saveState(); render(); }
    }
    if (action === 'export-excel') exportExcel(project);
    if (action === 'export-pdf') exportPdf(project);
    if (action === 'export-backup') { download('片场账本-数据备份-' + isoToday() + '.json', JSON.stringify(state, null, 2), 'application/json'); toast('备份已导出'); }
    if (action === 'import-backup') importInput.click();
    if (action === 'enable-notifications') {
      if (!('Notification' in window)) toast('当前浏览器不支持通知');
      else Notification.requestPermission().then(function (permission) { toast(permission === 'granted' ? '当天提醒已开启' : '未获得通知权限'); checkTodayNotifications(); });
    }
  });

  document.addEventListener('input', function (event) {
    var filter = event.target.dataset.filter;
    if (!filter) return;
    state.ledgerFilters[filter] = event.target.value;
    saveState();
    if (event.target.tagName === 'INPUT') {
      clearTimeout(render.filterTimer);
      render.filterTimer = setTimeout(render, 250);
    } else render();
  });

  importInput.addEventListener('change', function () {
    var file = importInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (!data || !Array.isArray(data.projects)) throw new Error('invalid');
        if (confirm('导入会覆盖当前全部数据，确定继续吗？')) { state = Object.assign(newState(), data); saveState(); render(); toast('数据已导入'); }
      } catch (error) { toast('备份文件无法识别'); }
      importInput.value = '';
    };
    reader.readAsText(file);
  });

  modal.addEventListener('click', function (event) {
    if (event.target === modal) closeModal();
  });

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(function () {});
  render();
  checkTodayNotifications();
})();
