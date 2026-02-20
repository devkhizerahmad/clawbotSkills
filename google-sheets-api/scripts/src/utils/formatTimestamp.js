'use strict';

function formatTimestamp(ts) {
  const [date, time] = ts.split('.')[0].split('T');
  const [year, month, day] = date.split('-');
  return `${parseInt(month)}/${parseInt(day)}/${parseInt(year)} ${time}`;
}

module.exports = { formatTimestamp };
