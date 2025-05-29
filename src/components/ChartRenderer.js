import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement, 
  LineElement,
  Filler
} from 'chart.js';
import { Bar, Doughnut, Pie, Line } from 'react-chartjs-2';
import './ChartRenderer.css';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  Filler
);

const ChartRenderer = ({ chartData }) => {
  if (!chartData || !chartData.chartConfig) {
    return <div className="chart-error">No chart data available</div>;
  }

  const { chartConfig, summary } = chartData;
  const { type, data, options } = chartConfig;

  // Map chart types to components
  const getChartComponent = () => {
    switch (type) {
      case 'bar':
      case 'horizontalBar':
        return <Bar data={data} options={options} />;
      case 'doughnut':
        return <Doughnut data={data} options={options} />;
      case 'pie':
        return <Pie data={data} options={options} />;
      case 'line':
      case 'area':
        return <Line data={data} options={options} />;
      default:
        return <div className="chart-error">Unsupported chart type: {type}</div>;
    }
  };

  return (
    <div className="chart-container">
      <div className="chart-wrapper">
        {getChartComponent()}
      </div>
      {summary && (
        <div className="chart-summary">
          <p>{summary}</p>
        </div>
      )}
    </div>
  );
};

export default ChartRenderer;