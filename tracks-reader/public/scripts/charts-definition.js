// Create the charts when the web page loads
window.addEventListener('load', onload);

function tooltipFormatter(points){
  var s = [];
  s.push('<span style="color: black;"><b>'+ epochToTime(Number(points[0].x)/1000) + ' :</b><span>');

  $.each(points, function(i, point) {
      s.push('<span style="color: '+ point.series.color +' ;">'+ point.series.name +' : <b>'+ point.y + 'W</b><span>');
  });
  return s.join(" <br/>");
}

function onload(event){
  chartG = null;
}

// Create General Chart
function createGeneralChart() {
  var chart = new Highcharts.Chart({
    chart:{ 
      renderTo:'chart-general',
      type: 'spline' 
    },
    series: [
      {
        name: 'Injection',
        tooltip: {valueSuffix: ' W'},
        yAxis: 0,
      },{
        name: 'AutoConso',
        tooltip: {valueSuffix: ' W'},
        yAxis: 0,
      },
      
      {
        name: 'Ei',
        tooltip: {valueSuffix: ' Wh'},
        yAxis: 1,
      },{
        name: 'Eac',
        tooltip: {valueSuffix: ' Wh'},
        yAxis: 1,
      },
      
    ],
    title: { 
      text: undefined
    },
    plotOptions: {
      line: { 
        animation: false,
        dataLabels: { 
          enabled: true 
        }
      }
    },
    xAxis: {
      type: 'datetime',
      dateTimeLabelFormats: { second: '%H:%M:%S' }
    },
    yAxis: [{
      title: { 
        text: 'Puissance (W)' 
      },
      min:-200,
      max:500,
      alignTicks: false,
      tickInterval: 100,
    },
    {
      title: { 
        text: 'Energyie Wh)',
      },
      opposite:true,
    }
    
    ],
    credits: { 
      enabled: false 
    },
    tooltip: {
      formatter: function() { return tooltipFormatter(this.points);},
      shared: true
    },
  });
  return chart;
}
