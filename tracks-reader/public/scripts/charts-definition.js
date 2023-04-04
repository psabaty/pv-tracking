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

  Highcharts.setOptions({
    time: {
        timezone: 'Europe/Paris'
    }
  });
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
        color: '#4ebbbf',
        tooltip: {valueSuffix: ' W'},
        yAxis: 0,
      },{
        name: 'AutoConso',
        color: '#8ebf4e',
        tooltip: {valueSuffix: ' W'},
        yAxis: 0,
      },
      
      {
        name: 'Ei',
        color: '#0099ff',
        tooltip: {valueSuffix: ' Wh'},
        yAxis: 1,
      },{
        name: 'Eac',
        color: '#0dff00',
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
        text: 'Energie Wh)',
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
