const form = document.querySelector('#early-access');
const success = document.querySelector('#early-access-success');
const restart = document.querySelector('#ea-restart');

if (form && success && restart) {
	form.addEventListener('submit', (event) => {
		event.preventDefault();
		if (!form.reportValidity()) return;

		form.hidden = true;
		success.hidden = false;
		success.focus();
	});

	restart.addEventListener('click', () => {
		form.reset();
		success.hidden = true;
		form.hidden = false;
		form.querySelector('input').focus();
	});
}
