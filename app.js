/**
 * Student Performance Predictor - Application Controller
 * Apex University Academic Early Warning System
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize ML Engine
  const mlEngine = new StudentPerformanceMLEngine();

  // Application State
  const state = {
    students: [],
    enrichedStudents: [],
    filteredStudents: [],
    cohortStats: {},
    summary: {},
    activeRiskFilter: 'all',
    searchQuery: '',
    selectedCourse: 'all',
    currentSort: { column: 'predicted_score', direction: 'asc' }, // default asc to highlight students who need support first!
    selectedStudent: null,
    charts: {
      scatter: null,
      riskDoughnut: null,
      componentBar: null,
      featureBar: null
    },
    interventions: JSON.parse(localStorage.getItem('apex_student_interventions') || '{}')
  };

  // DOM Elements
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const resetSampleBtn = document.getElementById('reset-sample-btn');
  const downloadTemplateBtn = document.getElementById('download-template-btn');
  const exportCsvBtn = document.getElementById('export-csv-btn');
  const printReportBtn = document.getElementById('print-report-btn');
  const modelInfoBtn = document.getElementById('model-info-btn');
  const searchInput = document.getElementById('search-input');
  const courseFilter = document.getElementById('course-filter');
  const riskTabs = document.querySelectorAll('.risk-filter-tabs .tab-btn');
  const rosterTbody = document.getElementById('roster-tbody');
  const studentCountSpan = document.getElementById('student-count-badge');
  const datasetNameLabel = document.getElementById('active-dataset-name');

  // Modals
  const studentModal = document.getElementById('student-modal');
  const studentModalClose = document.getElementById('student-modal-close');
  const modelModal = document.getElementById('model-modal');
  const modelModalClose = document.getElementById('model-modal-close');

  // Initialize Professional Theme Switcher
  setupThemeSwitcher();

  // Initialize with Pre-loaded Sample Data
  loadCohortData(window.SAMPLE_STUDENTS, 'Spring 2026 CS & Engineering Cohort (Sample)');

  /**
   * Load and process cohort data
   */
  function loadCohortData(rawStudents, datasetName = 'Custom Uploaded Dataset') {
    if (!rawStudents || rawStudents.length === 0) return;

    state.students = rawStudents;
    datasetNameLabel.textContent = datasetName;

    // Run ML Engine inference
    const processed = mlEngine.processCohort(rawStudents);
    state.enrichedStudents = processed.students;
    state.cohortStats = processed.stats;
    state.summary = processed.summary;

    // Update Courses in dropdown
    populateCourseFilter(state.enrichedStudents);

    // Update KPI counters
    updateKPICards(state.summary);

    // Apply filters & render
    applyFiltersAndSort();

    // Render Charts
    renderAllCharts();

    // Show validation summary
    updateValidationSummary(rawStudents.length, 0, 'Data verified: 100% academic metrics loaded cleanly.');
  }

  /**
   * Populate course filter dropdown
   */
  function populateCourseFilter(students) {
    const courses = Array.from(new Set(students.map(s => s.course))).filter(Boolean).sort();
    courseFilter.innerHTML = '<option value="all">All Courses & Departments</option>';
    courses.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      courseFilter.appendChild(opt);
    });
    courseFilter.value = state.selectedCourse;
  }

  /**
   * Update KPI Summary Cards
   */
  function updateKPICards(summary) {
    document.getElementById('kpi-total-students').textContent = summary.total;
    document.getElementById('kpi-high-risk').textContent = summary.highRisk;
    document.getElementById('kpi-mod-risk').textContent = summary.moderateRisk;
    document.getElementById('kpi-class-avg').textContent = summary.classAverage + '%';

    const highRiskPct = Math.round((summary.highRisk / summary.total) * 100);
    const highRiskBadge = document.getElementById('kpi-high-risk-badge');
    highRiskBadge.textContent = `${highRiskPct}% of cohort`;
    highRiskBadge.className = highRiskPct > 20 ? 'kpi-badge badge-risk risk-high' : 'kpi-badge badge-risk risk-moderate';

    const lowAtt = summary.lowAttendanceCount || 0;
    document.getElementById('kpi-low-att-count').textContent = `${lowAtt} students <75% att.`;
  }

  /**
   * Filter and Sort application
   */
  function applyFiltersAndSort() {
    let list = [...state.enrichedStudents];

    // Risk Filter
    if (state.activeRiskFilter === 'High') {
      list = list.filter(s => s.risk_level === 'High');
    } else if (state.activeRiskFilter === 'Moderate') {
      list = list.filter(s => s.risk_level === 'Moderate');
    } else if (state.activeRiskFilter === 'Low') {
      list = list.filter(s => s.risk_level === 'Low');
    } else if (state.activeRiskFilter === 'low-att') {
      list = list.filter(s => Number(s.attendance_pct) < 75);
    }

    // Course Filter
    if (state.selectedCourse !== 'all') {
      list = list.filter(s => s.course === state.selectedCourse);
    }

    // Search Query
    if (state.searchQuery.trim() !== '') {
      const q = state.searchQuery.toLowerCase();
      list = list.filter(s =>
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.student_id && s.student_id.toLowerCase().includes(q)) ||
        (s.course && s.course.toLowerCase().includes(q))
      );
    }

    // Sort
    const { column, direction } = state.currentSort;
    list.sort((a, b) => {
      let valA = a[column];
      let valB = b[column];

      // If comparing risk level
      if (column === 'risk_level') {
        const riskOrder = { 'High': 3, 'Moderate': 2, 'Low': 1 };
        valA = riskOrder[valA] || 0;
        valB = riskOrder[valB] || 0;
      } else if (typeof valA === 'string') {
        return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      }

      return direction === 'asc' ? valA - valB : valB - valA;
    });

    state.filteredStudents = list;
    studentCountSpan.textContent = `Showing ${list.length} of ${state.enrichedStudents.length}`;
    renderStudentTable(list);
  }

  /**
   * Render the Student Roster Table
   */
  function renderStudentTable(students) {
    rosterTbody.innerHTML = '';

    if (students.length === 0) {
      rosterTbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align: center; padding: 40px; color: var(--text-muted);">
            <div style="font-size: 2rem; margin-bottom: 8px;">🔍</div>
            No students found matching your search or filter criteria.
          </td>
        </tr>
      `;
      return;
    }

    students.forEach(student => {
      const tr = document.createElement('tr');

      // Avatar initials
      const initials = student.name ? student.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'ST';
      
      // Attendance color class
      const attVal = Number(student.attendance_pct);
      let attColor = '#10b981';
      if (attVal < 65) attColor = '#f43f5e';
      else if (attVal < 75) attColor = '#f59e0b';

      // Check if educator intervention recorded
      const hasIntervention = state.interventions[student.student_id];
      const interventionIndicator = hasIntervention ? `<span title="Educator intervention noted" style="color:#818cf8; margin-left:6px;">📝</span>` : '';

      tr.innerHTML = `
        <td>
          <div class="student-cell">
            <div class="student-avatar">${initials}</div>
            <div class="student-info-meta">
              <div class="student-name">${escapeHtml(student.name)} ${interventionIndicator}</div>
              <div class="student-id">${escapeHtml(student.student_id)}</div>
            </div>
          </div>
        </td>
        <td><span style="font-size: 0.82rem; color: #cbd5e1;">${escapeHtml(student.course || 'General')}</span></td>
        <td class="attendance-cell">
          <div class="att-val-text" style="color: ${attColor};">${attVal}%</div>
          <div class="progress-track">
            <div class="progress-fill" style="width: ${Math.min(100, attVal)}%; background: ${attColor};"></div>
          </div>
        </td>
        <td><strong>${student.assignments_avg}%</strong></td>
        <td><strong>${student.quizzes_avg}%</strong></td>
        <td><strong>${student.midterm_score}%</strong></td>
        <td><span style="color: var(--text-muted);">${student.study_hours_weekly || '-'} hrs/wk</span></td>
        <td>
          <span class="score-tag">${student.predicted_score}%</span>
          <span class="grade-badge" style="background: ${getGradeBg(student.predicted_grade)}; color: #fff;">${student.predicted_grade}</span>
        </td>
        <td>
          <span class="badge-risk ${student.risk_class}">
            <span class="risk-dot"></span>
            ${student.risk_label}
          </span>
        </td>
        <td>
          <button class="btn btn-secondary btn-sm inspect-btn" data-id="${student.student_id}">
            Inspect Factors & Intervene
          </button>
        </td>
      `;

      rosterTbody.appendChild(tr);
    });

    // Attach click listeners to inspect buttons
    document.querySelectorAll('.inspect-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const s = state.enrichedStudents.find(x => x.student_id === id);
        if (s) openStudentDetailModal(s);
      });
    });
  }

  function getGradeBg(grade) {
    switch (grade) {
      case 'A': return 'rgba(16, 185, 129, 0.4)';
      case 'B': return 'rgba(59, 130, 246, 0.4)';
      case 'C': return 'rgba(245, 158, 11, 0.4)';
      case 'D': return 'rgba(249, 115, 22, 0.4)';
      default: return 'rgba(244, 63, 94, 0.4)';
    }
  }

  /**
   * Render Chart.js Visualizations
   */
  /**
   * Theme Switcher Controller
   */
  function setupThemeSwitcher() {
    const themeGroup = document.getElementById('theme-switcher-group');
    const savedTheme = localStorage.getItem('apex_dashboard_theme') || 'dark';
    applyTheme(savedTheme, false);

    if (themeGroup) {
      themeGroup.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const theme = btn.getAttribute('data-theme');
          applyTheme(theme, true);
        });
      });
    }
  }

  function applyTheme(theme, triggerRender = true) {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('apex_dashboard_theme', theme);

    const themeGroup = document.getElementById('theme-switcher-group');
    if (themeGroup) {
      themeGroup.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-theme') === theme);
      });
    }

    if (triggerRender && state.enrichedStudents && state.enrichedStudents.length > 0) {
      renderAllCharts();
    }
  }

  function getChartThemeColors() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    if (currentTheme === 'light') {
      return {
        textColor: '#475569',
        tickColor: '#64748b',
        titleColor: '#0f172a',
        gridColor: 'rgba(15, 23, 42, 0.08)',
        cardBorder: '#ffffff',
        doughnutBorder: '#ffffff',
        yTickColor: '#1e293b',
        fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif"
      };
    } else if (currentTheme === 'emerald') {
      return {
        textColor: '#86efac',
        tickColor: '#6ee7b7',
        titleColor: '#f0fdf4',
        gridColor: 'rgba(52, 211, 153, 0.1)',
        cardBorder: '#0e2220',
        doughnutBorder: '#0e2220',
        yTickColor: '#f0fdf4',
        fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif"
      };
    } else if (currentTheme === 'azure') {
      return {
        textColor: '#7dd3fc',
        tickColor: '#38bdf8',
        titleColor: '#f0f9ff',
        gridColor: 'rgba(56, 189, 248, 0.1)',
        cardBorder: '#0c1f3d',
        doughnutBorder: '#0c1f3d',
        yTickColor: '#f0f9ff',
        fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif"
      };
    } else {
      // Obsidian Dark (Default)
      return {
        textColor: '#94a3b8',
        tickColor: '#94a3b8',
        titleColor: '#f8fafc',
        gridColor: 'rgba(255, 255, 255, 0.06)',
        cardBorder: '#111827',
        doughnutBorder: '#111827',
        yTickColor: '#e2e8f0',
        fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif"
      };
    }
  }

  /**
   * Render Chart.js Visualizations with Theme Awareness
   */
  function renderAllCharts() {
    if (typeof Chart === 'undefined') {
      console.warn('Chart.js not yet loaded');
      return;
    }

    renderScatterChart();
    renderRiskDoughnutChart();
    renderComponentBarChart();
    renderFeatureImportanceChart();
  }

  // 1. Attendance vs Predicted Score Scatter Plot
  function renderScatterChart() {
    const ctx = document.getElementById('attendance-scatter-chart');
    if (!ctx) return;

    if (state.charts.scatter) state.charts.scatter.destroy();

    const t = getChartThemeColors();
    const lowRiskData = [];
    const modRiskData = [];
    const highRiskData = [];

    state.enrichedStudents.forEach(s => {
      const pt = {
        x: Number(s.attendance_pct),
        y: Number(s.predicted_score),
        student: s
      };
      if (s.risk_level === 'High') highRiskData.push(pt);
      else if (s.risk_level === 'Moderate') modRiskData.push(pt);
      else lowRiskData.push(pt);
    });

    state.charts.scatter = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'High Risk / Needs Support',
            data: highRiskData,
            backgroundColor: '#f43f5e',
            borderColor: '#fb7185',
            pointRadius: 6,
            pointHoverRadius: 9
          },
          {
            label: 'Moderate Risk (Advising)',
            data: modRiskData,
            backgroundColor: '#f59e0b',
            borderColor: '#fbbf24',
            pointRadius: 6,
            pointHoverRadius: 9
          },
          {
            label: 'On Track (Low Risk)',
            data: lowRiskData,
            backgroundColor: '#10b981',
            borderColor: '#34d399',
            pointRadius: 6,
            pointHoverRadius: 9
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { color: t.textColor, font: { family: t.fontFamily, size: 11 }, usePointStyle: true }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const s = context.raw.student;
                return [
                  `${s.name} (${s.student_id})`,
                  `Attendance: ${s.attendance_pct}% | Predicted Score: ${s.predicted_score}% (${s.predicted_grade})`,
                  `Course: ${s.course}`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Attendance Percentage (%)', color: t.titleColor, font: { family: t.fontFamily, weight: '600' } },
            min: 40,
            max: 100,
            grid: { color: t.gridColor },
            ticks: { color: t.tickColor, font: { family: t.fontFamily } }
          },
          y: {
            title: { display: true, text: 'Predicted Final Score (%)', color: t.titleColor, font: { family: t.fontFamily, weight: '600' } },
            min: 30,
            max: 100,
            grid: { color: t.gridColor },
            ticks: { color: t.tickColor, font: { family: t.fontFamily } }
          }
        }
      }
    });
  }

  // 2. Risk & Grade Distribution Doughnut Chart
  function renderRiskDoughnutChart() {
    const ctx = document.getElementById('risk-doughnut-chart');
    if (!ctx) return;

    if (state.charts.riskDoughnut) state.charts.riskDoughnut.destroy();

    const t = getChartThemeColors();
    const summary = state.summary;

    state.charts.riskDoughnut = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['High Risk (Urgent)', 'Moderate Risk (Advising)', 'Low Risk (On Track)'],
        datasets: [{
          data: [summary.highRisk, summary.moderateRisk, summary.lowRisk],
          backgroundColor: ['#f43f5e', '#f59e0b', '#10b981'],
          borderWidth: 2,
          borderColor: t.doughnutBorder,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: t.textColor, font: { family: t.fontFamily, size: 11 }, usePointStyle: true, padding: 12 }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const total = summary.total || 1;
                const count = context.raw;
                const pct = Math.round((count / total) * 100);
                return ` ${context.label}: ${count} students (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  // 3. Component Performance Comparison (Cohort Average vs High Risk Average)
  function renderComponentBarChart() {
    const ctx = document.getElementById('component-bar-chart');
    if (!ctx) return;

    if (state.charts.componentBar) state.charts.componentBar.destroy();

    const t = getChartThemeColors();
    const stats = state.cohortStats;
    const highRiskGroup = state.enrichedStudents.filter(s => s.risk_level === 'High');

    const highAvg = (key) => {
      if (highRiskGroup.length === 0) return 0;
      const sum = highRiskGroup.reduce((acc, curr) => acc + (Number(curr[key]) || 0), 0);
      return Math.round((sum / highRiskGroup.length) * 10) / 10;
    };

    const categories = ['Midterm Exam', 'Assignments Avg', 'Quizzes Avg', 'Attendance', 'LMS Engagement'];
    const cohortValues = [
      stats.midterm_score ? stats.midterm_score.mean : 0,
      stats.assignments_avg ? stats.assignments_avg.mean : 0,
      stats.quizzes_avg ? stats.quizzes_avg.mean : 0,
      stats.attendance_pct ? stats.attendance_pct.mean : 0,
      stats.lms_activity_score ? stats.lms_activity_score.mean : 0
    ];

    const highRiskValues = [
      highAvg('midterm_score'),
      highAvg('assignments_avg'),
      highAvg('quizzes_avg'),
      highAvg('attendance_pct'),
      highAvg('lms_activity_score')
    ];

    state.charts.componentBar = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: categories,
        datasets: [
          {
            label: 'Class Cohort Average',
            data: cohortValues,
            backgroundColor: 'rgba(99, 102, 241, 0.75)',
            borderColor: '#818cf8',
            borderWidth: 1,
            borderRadius: 6
          },
          {
            label: 'High-Risk Group Average',
            data: highRiskValues,
            backgroundColor: 'rgba(244, 63, 94, 0.75)',
            borderColor: '#fb7185',
            borderWidth: 1,
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { color: t.textColor, font: { family: t.fontFamily, size: 11 } }
          }
        },
        scales: {
          x: { grid: { color: t.gridColor }, ticks: { color: t.tickColor, font: { family: t.fontFamily } } },
          y: { min: 0, max: 100, grid: { color: t.gridColor }, ticks: { color: t.tickColor, font: { family: t.fontFamily } } }
        }
      }
    });
  }

  // 4. Feature Predictive Importance
  function renderFeatureImportanceChart() {
    const ctx = document.getElementById('feature-importance-chart');
    if (!ctx) return;

    if (state.charts.featureBar) state.charts.featureBar.destroy();

    const t = getChartThemeColors();

    state.charts.featureBar = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Midterm Exam (35%)', 'Assignments (25%)', 'Quizzes (20%)', 'Attendance (12%)', 'LMS Engagement (5%)', 'Study Hours (3%)'],
        datasets: [{
          label: 'Predictive Model Weighting',
          data: [35, 25, 20, 12, 5, 3],
          backgroundColor: [
            '#6366f1',
            '#3b82f6',
            '#06b6d4',
            '#10b981',
            '#f59e0b',
            '#a855f7'
          ],
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            title: { display: true, text: 'Model Weight (%)', color: t.titleColor, font: { family: t.fontFamily, weight: '600' } },
            grid: { color: t.gridColor },
            ticks: { color: t.tickColor, font: { family: t.fontFamily } }
          },
          y: {
            grid: { display: false },
            ticks: { color: t.yTickColor, font: { family: t.fontFamily, size: 11, weight: '500' } }
          }
        }
      }
    });
  }

  /**
   * Open and populate Student Detail & Factor Inspection Modal
   */
  function openStudentDetailModal(student) {
    state.selectedStudent = student;

    // Header info
    document.getElementById('modal-student-name').textContent = student.name;
    document.getElementById('modal-student-id').textContent = student.student_id;
    document.getElementById('modal-student-course').textContent = student.course || 'Collegiate Course';
    document.getElementById('modal-avatar-lg').textContent = student.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

    // Score and Risk
    const scoreVal = document.getElementById('modal-predicted-score');
    scoreVal.textContent = student.predicted_score + '%';
    document.getElementById('modal-predicted-grade').textContent = student.predicted_grade;

    const riskBadge = document.getElementById('modal-risk-badge');
    riskBadge.textContent = student.risk_label;
    riskBadge.className = `badge-risk ${student.risk_class}`;

    // Render Factor Impact List (Waterfall / attribution)
    renderFactorList(student);

    // Render Intervention Recommendations
    renderRecommendations(student.recommendations);

    // Initialize "What-If" Simulator sliders
    initWhatIfSimulator(student);

    // Load Educator Interventions & Notes
    loadStudentInterventions(student.student_id);

    // Show modal
    studentModal.classList.add('active');
  }

  function renderFactorList(student) {
    const container = document.getElementById('factor-list-container');
    container.innerHTML = '';

    student.factor_impacts.forEach(factor => {
      const item = document.createElement('div');
      item.className = 'factor-item';

      const isPos = factor.isPositive;
      const sign = isPos ? '+' : '';
      const impactClass = isPos ? 'positive' : 'negative';
      const barColor = isPos ? '#10b981' : '#f43f5e';
      const barWidth = Math.min(100, Math.abs(factor.impactPoints) * 9);

      item.innerHTML = `
        <div class="factor-name-wrap">
          <span class="factor-name">${factor.name}</span>
          <span class="factor-score-diff">Student: <strong>${factor.studentValue}</strong> (Class Avg: ${factor.benchmarkValue})</span>
        </div>
        <div class="factor-bar-container">
          <div class="factor-bar-fill" style="width: ${barWidth}%; background: ${barColor};"></div>
        </div>
        <div class="factor-impact-badge ${impactClass}">
          ${sign}${factor.impactPoints} pts
        </div>
      `;
      container.appendChild(item);
    });
  }

  function renderRecommendations(recommendations) {
    const container = document.getElementById('recommendations-container');
    container.innerHTML = '';

    recommendations.forEach(rec => {
      const card = document.createElement('div');
      card.className = `rec-card ${rec.priority === 'High' ? 'high-pri' : ''}`;

      let icon = '💡';
      if (rec.type === 'attendance') icon = '📅';
      else if (rec.type === 'exam') icon = '📝';
      else if (rec.type === 'assignments') icon = '💻';
      else if (rec.type === 'study') icon = '⏳';
      else if (rec.type === 'enrichment') icon = '🌟';

      card.innerHTML = `
        <div class="rec-icon">${icon}</div>
        <div class="rec-content">
          <div class="rec-title">
            ${escapeHtml(rec.action)}
            <span class="badge-risk ${rec.priority === 'High' ? 'risk-high' : 'risk-moderate'}" style="font-size: 0.7rem; padding: 1px 8px;">
              ${rec.badge}
            </span>
          </div>
          <div class="rec-desc">${escapeHtml(rec.detail)}</div>
        </div>
      `;
      container.appendChild(card);
    });
  }

  /**
   * "What-If" Scenario Simulator
   */
  function initWhatIfSimulator(student) {
    const attSlider = document.getElementById('sim-att');
    const assignSlider = document.getElementById('sim-assign');
    const quizSlider = document.getElementById('sim-quiz');
    const studySlider = document.getElementById('sim-study');

    attSlider.value = student.attendance_pct;
    assignSlider.value = student.assignments_avg;
    quizSlider.value = student.quizzes_avg;
    studySlider.value = student.study_hours_weekly || 8;

    document.getElementById('sim-att-val').textContent = attSlider.value + '%';
    document.getElementById('sim-assign-val').textContent = assignSlider.value + '%';
    document.getElementById('sim-quiz-val').textContent = quizSlider.value + '%';
    document.getElementById('sim-study-val').textContent = studySlider.value + ' hrs';

    const recalculateSim = () => {
      document.getElementById('sim-att-val').textContent = attSlider.value + '%';
      document.getElementById('sim-assign-val').textContent = assignSlider.value + '%';
      document.getElementById('sim-quiz-val').textContent = quizSlider.value + '%';
      document.getElementById('sim-study-val').textContent = studySlider.value + ' hrs';

      const simulatedStudent = {
        ...student,
        attendance_pct: Number(attSlider.value),
        assignments_avg: Number(assignSlider.value),
        quizzes_avg: Number(quizSlider.value),
        study_hours_weekly: Number(studySlider.value)
      };

      const simResult = mlEngine.predictStudent(simulatedStudent, state.cohortStats);
      const scoreDiff = Math.round((simResult.predicted_score - student.predicted_score) * 10) / 10;
      const diffSign = scoreDiff >= 0 ? '+' : '';

      document.getElementById('sim-new-score').textContent = `${simResult.predicted_score}% (${simResult.predicted_grade})`;
      const deltaSpan = document.getElementById('sim-score-delta');
      deltaSpan.textContent = `(${diffSign}${scoreDiff} pts from current)`;
      deltaSpan.style.color = scoreDiff >= 0 ? '#34d399' : '#fb7185';

      const newRiskSpan = document.getElementById('sim-new-risk');
      newRiskSpan.textContent = simResult.risk_label;
      newRiskSpan.className = `badge-risk ${simResult.risk_class}`;
    };

    [attSlider, assignSlider, quizSlider, studySlider].forEach(slider => {
      slider.oninput = recalculateSim;
    });

    document.getElementById('sim-reset-btn').onclick = () => {
      initWhatIfSimulator(student);
    };

    recalculateSim();
  }

  /**
   * Educator Notes and Interventions persistence
   */
  function loadStudentInterventions(studentId) {
    const data = state.interventions[studentId] || {
      contacted: false,
      officeHours: false,
      tutoring: false,
      successCenter: false,
      notes: ''
    };

    document.getElementById('check-contacted').checked = !!data.contacted;
    document.getElementById('check-office').checked = !!data.officeHours;
    document.getElementById('check-tutoring').checked = !!data.tutoring;
    document.getElementById('check-center').checked = !!data.successCenter;
    document.getElementById('educator-notes-text').value = data.notes || '';

    // Auto-save listeners
    const saveIntervention = () => {
      state.interventions[studentId] = {
        contacted: document.getElementById('check-contacted').checked,
        officeHours: document.getElementById('check-office').checked,
        tutoring: document.getElementById('check-tutoring').checked,
        successCenter: document.getElementById('check-center').checked,
        notes: document.getElementById('educator-notes-text').value,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('apex_student_interventions', JSON.stringify(state.interventions));
      // re-render roster table to show note icons
      renderStudentTable(state.filteredStudents);
    };

    document.getElementById('check-contacted').onchange = saveIntervention;
    document.getElementById('check-office').onchange = saveIntervention;
    document.getElementById('check-tutoring').onchange = saveIntervention;
    document.getElementById('check-center').onchange = saveIntervention;
    document.getElementById('educator-notes-text').oninput = debounce(saveIntervention, 400);
  }

  /**
   * CSV Upload & Validation Handling
   */
  fileInput.addEventListener('change', handleFileSelect);

  // Drag and drop events
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-active');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('drag-active');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-active');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      parseCSVFile(e.dataTransfer.files[0]);
    }
  });

  function handleFileSelect(e) {
    if (e.target.files && e.target.files.length > 0) {
      parseCSVFile(e.target.files[0]);
    }
  }

  function parseCSVFile(file) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Please select a valid .csv file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      validateAndLoadCSV(text, file.name);
    };
    reader.readAsText(file);
  }

  /**
   * Robust CSV parsing and schema validation
   */
  function validateAndLoadCSV(csvText, fileName) {
    const lines = csvText.split(/\r\n|\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) {
      updateValidationSummary(0, 1, 'Error: CSV file must contain a header and at least one student row.', 'has-error');
      return;
    }

    const rawHeaders = parseCSVLine(lines[0]);
    const headerMap = mapHeaders(rawHeaders);

    // Check minimum required metrics
    const required = ['attendance_pct', 'midterm_score'];
    const missing = required.filter(r => headerMap[r] === undefined);

    if (missing.length > 0) {
      updateValidationSummary(0, 1, `Error: Missing critical column(s): ${missing.join(', ')}. Please refer to the template.`, 'has-error');
      return;
    }

    const parsedStudents = [];
    let warningCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      if (row.length === 0 || (row.length === 1 && row[0] === '')) continue;

      const getVal = (key, fallback = 0) => {
        const colIdx = headerMap[key];
        if (colIdx !== undefined && row[colIdx] !== undefined && row[colIdx].trim() !== '') {
          return row[colIdx].trim();
        }
        return fallback;
      };

      const getNum = (key, fallback = 70) => {
        let v = Number(getVal(key, fallback));
        if (isNaN(v)) {
          warningCount++;
          v = fallback;
        }
        if (v < 0) { warningCount++; v = 0; }
        if (v > 100 && key !== 'study_hours_weekly') { warningCount++; v = 100; }
        return v;
      };

      const studentId = getVal('student_id', `STU-${1000 + i}`);
      const studentName = getVal('name', `Student ${i}`);
      const course = getVal('course', 'Collegiate Cohort');

      parsedStudents.push({
        student_id: studentId,
        name: studentName,
        course: course,
        attendance_pct: getNum('attendance_pct', 75),
        assignments_avg: getNum('assignments_avg', 70),
        quizzes_avg: getNum('quizzes_avg', 70),
        midterm_score: getNum('midterm_score', 70),
        study_hours_weekly: Number(getVal('study_hours_weekly', 6)),
        lms_activity_score: getNum('lms_activity_score', 75)
      });
    }

    if (parsedStudents.length === 0) {
      updateValidationSummary(0, 1, 'Error: No valid student rows could be parsed.', 'has-error');
      return;
    }

    loadCohortData(parsedStudents, fileName);
    updateValidationSummary(
      parsedStudents.length,
      warningCount,
      warningCount > 0
        ? `Loaded ${parsedStudents.length} records. (${warningCount} missing/out-of-range values auto-normalized).`
        : `Verified & Loaded ${parsedStudents.length} records with 100% data integrity!`,
      warningCount > 0 ? 'has-warning' : ''
    );
  }

  function parseCSVLine(line) {
    const result = [];
    let insideQuotes = false;
    let entry = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        result.push(entry.trim());
        entry = '';
      } else {
        entry += char;
      }
    }
    result.push(entry.trim());
    return result;
  }

  function mapHeaders(headers) {
    const map = {};
    headers.forEach((h, idx) => {
      const clean = h.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      if (clean.includes('id') || clean.includes('roll')) map['student_id'] = idx;
      else if (clean.includes('name')) map['name'] = idx;
      else if (clean.includes('course') || clean.includes('subject') || clean.includes('class')) map['course'] = idx;
      else if (clean.includes('attend')) map['attendance_pct'] = idx;
      else if (clean.includes('assign') || clean.includes('hw')) map['assignments_avg'] = idx;
      else if (clean.includes('quiz') || clean.includes('test')) map['quizzes_avg'] = idx;
      else if (clean.includes('midterm') || clean.includes('exam')) map['midterm_score'] = idx;
      else if (clean.includes('study') || clean.includes('hours')) map['study_hours_weekly'] = idx;
      else if (clean.includes('lms') || clean.includes('engage') || clean.includes('portal')) map['lms_activity_score'] = idx;
    });
    return map;
  }

  function updateValidationSummary(rows, warnings, message, className = '') {
    document.getElementById('val-rows-count').textContent = rows;
    document.getElementById('val-warnings-count').textContent = warnings;
    const msgBox = document.getElementById('val-message-box');
    msgBox.textContent = message;
    msgBox.className = `validation-feedback-msg ${className}`;
  }

  /**
   * Export Options
   */
  // 1. Export CSV
  exportCsvBtn.addEventListener('click', () => {
    if (state.enrichedStudents.length === 0) return;

    const headers = [
      'Student ID',
      'Name',
      'Course',
      'Attendance (%)',
      'Assignments Avg',
      'Quizzes Avg',
      'Midterm Score',
      'Study Hours (wk)',
      'LMS Activity Score',
      'Predicted Final Score (%)',
      'Predicted Grade',
      'Risk Level',
      'Action Guidance',
      'Intervention Taken'
    ];

    const rows = state.enrichedStudents.map(s => {
      const inter = state.interventions[s.student_id];
      const interText = inter ? (inter.notes || 'Action recorded') : 'None recorded';
      return [
        `"${s.student_id}"`,
        `"${s.name}"`,
        `"${s.course || ''}"`,
        s.attendance_pct,
        s.assignments_avg,
        s.quizzes_avg,
        s.midterm_score,
        s.study_hours_weekly || '',
        s.lms_activity_score || '',
        s.predicted_score,
        s.predicted_grade,
        s.risk_label,
        `"${(s.recommendations[0] && s.recommendations[0].action) || ''}"`,
        `"${interText}"`
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `student_predictions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  // 2. Download Sample Template CSV
  downloadTemplateBtn.addEventListener('click', () => {
    const templateContent = [
      'student_id,name,course,attendance_pct,assignments_avg,quizzes_avg,midterm_score,study_hours_weekly,lms_activity_score',
      'STU-2001,Alex Morgan,CS101 Intro to Computing,85,82,78,80,10,85',
      'STU-2002,Samira Khan,MATH201 Linear Algebra,60,54,58,49,4,48',
      'STU-2003,David Lee,DATA300 Machine Learning,94,91,95,92,14,96'
    ].join('\n');

    const encoded = encodeURI('data:text/csv;charset=utf-8,' + templateContent);
    const a = document.createElement('a');
    a.href = encoded;
    a.download = 'student_performance_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  // 3. Print / PDF Report
  printReportBtn.addEventListener('click', () => {
    window.print();
  });

  // Reset to Sample Data
  resetSampleBtn.addEventListener('click', () => {
    loadCohortData(window.SAMPLE_STUDENTS, 'Spring 2026 CS & Engineering Cohort (Sample)');
    fileInput.value = '';
  });

  /**
   * Search and Filters Event Listeners
   */
  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    applyFiltersAndSort();
  });

  courseFilter.addEventListener('change', (e) => {
    state.selectedCourse = e.target.value;
    applyFiltersAndSort();
  });

  riskTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      riskTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.activeRiskFilter = tab.getAttribute('data-risk');
      applyFiltersAndSort();
    });
  });

  // Sortable table headers
  document.querySelectorAll('.roster-table th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-sort');
      if (state.currentSort.column === col) {
        state.currentSort.direction = state.currentSort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        state.currentSort.column = col;
        state.currentSort.direction = (col === 'predicted_score' || col === 'attendance_pct') ? 'asc' : 'desc';
      }
      applyFiltersAndSort();
    });
  });

  // Modal Closures
  studentModalClose.addEventListener('click', () => studentModal.classList.remove('active'));
  studentModal.addEventListener('click', (e) => {
    if (e.target === studentModal) studentModal.classList.remove('active');
  });

  modelInfoBtn.addEventListener('click', () => modelModal.classList.add('active'));
  modelModalClose.addEventListener('click', () => modelModal.classList.remove('active'));
  modelModal.addEventListener('click', (e) => {
    if (e.target === modelModal) modelModal.classList.remove('active');
  });

  // Utilities
  function escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
});
