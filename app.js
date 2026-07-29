const cameraInput = document.querySelector("#cameraInput");
const cameraButton = document.querySelector("#cameraButton");
const photo = document.querySelector("#photo");
const placeholder = document.querySelector("#placeholder");
const buttonText = document.querySelector("#buttonText");
const status = document.querySelector("#status");

const state = { photoUrl: undefined };

const showPhoto = file => {
  if (!file?.type.startsWith("image/")) {
    status.textContent = "Bitte wähle eine Bilddatei aus.";
    return;
  }

  if (state.photoUrl) URL.revokeObjectURL(state.photoUrl);

  state.photoUrl = URL.createObjectURL(file);
  photo.src = state.photoUrl;
  photo.hidden = false;
  placeholder.hidden = true;
  buttonText.textContent = "Neues Foto aufnehmen";
  status.textContent = "Foto aufgenommen – es bleibt auf deinem Gerät.";
};

cameraButton.addEventListener("click", () => {
  cameraInput.value = "";
  cameraInput.click();
});

cameraInput.addEventListener("change", event => {
  const [file] = event.target.files;
  if (file) showPhoto(file);
});

window.addEventListener("beforeunload", () => {
  if (state.photoUrl) URL.revokeObjectURL(state.photoUrl);
});
