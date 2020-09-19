import $ from 'jquery';

$(() => {
  $('#join').submit(e => {
    document.location.href = $('#join input').val();
    e.preventDefault();
    return false;
  });
});