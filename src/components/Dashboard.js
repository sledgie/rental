import React from 'react';
import './Dashboard.css';

const Dashboard = () => {
  return (
    <div className="dashboard-container">
      <div className="sidebar">
        <h2>Rental Manager</h2>
        <nav>
          <ul>
            <li><a href="#dashboard">Dashboard</a></li>
            <li><a href="#properties">Properties</a></li>
            <li><a href="#tenants">Tenants</a></li>
            <li><a href="#financials">Financials</a></li>
            <li><a href="#reports">Reports</a></li>
          </ul>
        </nav>
      </div>

      <div className="main-content">
        <header>
          <h1>Dashboard</h1>
        </header>

        <div className="stats-container">
          <div className="stat-card">
            <h3>Properties</h3>
            <p>12</p>
          </div>
          <div className="stat-card">
            <h3>Tenants</h3>
            <p>8</p>
          </div>
          <div className="stat-card">
            <h3>Income</h3>
            <p>$4,200</p>
          </div>
          <div className="stat-card">
            <h3>Expenses</h3>
            <p>$1,800</p>
          </div>
        </div>

        <div className="properties-section">
          <h2>Properties</h2>
          <div className="property-list">
            <div className="property-item">
              <h3>46 Brewster</h3>
              <p>Rented - $1,200/month</p>
            </div>
            <div className="property-item">
              <h3>3 Streamdale</h3>
              <p>Available</p>
            </div>
            <div className="property-item">
              <h3>23 Enclave</h3>
              <p>Rented - $950/month</p>
            </div>
          </div>
        </div>

        <div className="activity-section">
          <h2>Recent Activity</h2>
          <div className="activity-item">
            <span>Property 101 rented to John Smith</span>
            <small>2 hours ago</small>
          </div>
          <div className="activity-item">
            <span>Monthly rent payment received</span>
            <small>1 day ago</small>
          </div>
          <div className="activity-item">
            <span>Maintenance request submitted</span>
            <small>3 days ago</small>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;