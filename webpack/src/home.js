import $ from 'jquery';

$(() => {
  $('#join').submit(e => {
    document.location.href = $('#join input').val().toLowerCase();
    e.preventDefault();
    return false;
  });
});