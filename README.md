# Apex University · Student Performance Predictor & Early Warning System

A web-based academic analytics and early intervention platform designed for university advisors, instructors, and student success coordinators.

---

## 🌟 Key Features

1. **Academic Early Warning Engine**:
   - Computes weighted composite success metrics using non-sensitive academic indicators: Midterm Exam (35%), Assignments (25%), Quizzes (20%), Attendance (12%), LMS Engagement (5%), and Study Hours (3%).
   - Dynamic non-linear attendance penalty modeling (<65% attendance triggers compounded intervention flag).
   - High-precision classification: **Urgent Support** (High Risk), **Advising Recommended** (Moderate Risk), and **On Track** (Low Risk).

2. **Explainable AI (XAI) Attribution**:
   - Inspect individual student factor impacts (e.g., `-9.8 pts` from Attendance vs cohort benchmark).
   - Formative, non-punitive recommendations tailored to each student's specific risk factors.

3. **Interactive "What-If" Intervention Simulator**:
   - Sliders allowing advisors to simulate academic improvement (e.g. +15% attendance via tutoring) and view real-time projected final grade lift.

4. **100% Client-Side Privacy (FERPA Compliant)**:
   - Zero sensitive demographic attributes used.
   - All computation and CSV ingestion occurs locally within the browser session—no student data ever leaves the device.

5. **Data Ingestion & Cohort Management**:
   - Drag & drop CSV upload with auto-detection of column headers and real-time schema validation.
   - Download pre-calibrated sample cohort data and formatted CSV templates.
   - Real-time searching, course filtering, and sortable tables.
   - Export analyzed cohort with predictions and risk flags to CSV.

6. **Executive Multi-Theme Design System**:
   - 🌙 **Obsidian Dark**: Default high-contrast executive dark mode with subtle ambient lighting and glassmorphism.
   - ☀️ **Institutional Light**: Crisp, clean academic white theme tailored for administrative presentations and campus reports.
   - 🌲 **Nordic Emerald**: Quantitative analytics theme with forest slate and vibrant mint/emerald accents.
   - 🔷 **Cyber Azure**: Deep ocean navy theme with electric cyan and sapphire highlights.
   - Real-time Chart.js synchronization that dynamically updates gridlines, text colors, and tooltips upon switching.

---

## 🚀 Running the Application

### Option 1: Using Node.js (Zero external dependencies)
```bash
npm start
# or
node server.js
```

### Option 2: Direct Browser Access
Because the application runs purely client-side with native ES modules and Chart.js via CDN, you can also open `index.html` directly in any modern web browser.

---

## 📁 Project Structure

```
├── index.html        # Main dashboard layout with semantic markup and accessible components
├── index.css         # Modern design system (dark glassmorphism, responsive grid, animations)
├── app.js            # Dashboard UI controller, chart rendering, filters, and simulator
├── ml_engine.js      # Student Performance ML & Explainability Engine
├── sample_data.js    # Pre-loaded realistic 60-student collegiate cohort
├── sample-data.csv   # Standalone CSV dataset for testing drag-and-drop ingestion
├── server.js         # Zero-dependency local Node.js static HTTP server (Port 3000)
└── package.json      # Project metadata and start scripts
```

---

## 📊 Live Local URL
Once the server is running, access the dashboard at:
[http://localhost:3000/](http://localhost:3000/)
