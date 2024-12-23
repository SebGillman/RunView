console.log("MANAGE MODAL ADDED");
document.addEventListener("DOMContentLoaded", function () {
  console.log("MANAGE MODAL INIT");
  const manageGameElement = document.getElementById("manage-game");
  const manageGameModal = document.getElementById("manage-game-modal");

  const manageGameModalCloseButton = document.getElementById(
    "manage-game-modal-close"
  );
  const manageGameModalGameName = document.getElementById(
    "manage-game-modal-game-name"
  );
  const manageGameModalTeamNamesContainer = document.getElementById(
    "manage-game-modal-team-names-container"
  );
  const manageGameModalTeamNamesDiv = document.getElementById(
    "manage-game-modal-team-names"
  );
  const manageGameModalAddTeamButton = document.getElementById(
    "manage-game-modal-add-team"
  );
  const manageGameModalGameIdDiv = document.getElementById(
    "manage-game-modal-game-id"
  );
  const manageGameModalGamePasswordDiv = document.getElementById(
    "manage-game-modal-game-password"
  );
  const manageGameModalDeleteButton = document.getElementById(
    "manage-game-modal-delete"
  );
  const manageGameModalSaveButton = document.getElementById(
    "manage-game-modal-save"
  );

  function resetManageModal() {
    manageGameModalTeamNamesDiv.replaceChildren();
    manageGameModalTeamNamesDiv.innerHTML = `
<input type="text" name="manage-game-modal-team-name" placeholder="Enter team name" class="text-field"/>`;

    manageGameModalGameName.value = window.game_name;
    manageGameModalGameIdDiv.value = window.game_id;
    manageGameModalGamePasswordDiv.value = window.game_password;
  }

  manageGameElement.addEventListener("click", function () {
    // manage game modal show
    console.log("manage game modal");
    document.documentElement.style.overflowY = "hidden"; // Prevent body scrolling
    manageGameModal.style.display = "flex";

    manageGameModalTeamNamesContainer.style.display =
      window.team === null || window.team === undefined ? "none" : "flex";

    resetManageModal();
  });

  manageGameModalCloseButton.addEventListener("click", function () {
    document.documentElement.style.overflowY = "auto"; // Allow body scrolling
    manageGameModal.style.display = "none";
    resetManageModal();
  });

  manageGameModalAddTeamButton.addEventListener("click", () => {
    const newTeamInput = document.createElement("input");
    newTeamInput.type = "text";
    newTeamInput.name = "manage-game-modal-team-name";
    newTeamInput.className = "text-field";
    newTeamInput.placeholder = "Enter team name";
    manageGameModalTeamNamesDiv.appendChild(newTeamInput);
  });

  manageGameModalTeamNamesDiv.addEventListener("change", () => {
    manageGameModalTeamPicker.innerHTML =
      "<option disabled>Pick your team</option>";
    Array.from(
      document.querySelectorAll('input[name="manage-game-modal-team-name"]')
    )
      .filter((input) => input.value !== "")
      .forEach((input) => {
        const option = document.createElement("option");
        option.value = input.value;
        option.innerText = input.value;

        manageGameModalTeamPicker.appendChild(option);
      });
  });

  manageGameModalSaveButton.addEventListener("click", async () => {
    const gameId = window.game_id;
    const gameName = manageGameModalGameName.value;
    const teamNames = Array.from(
      document.querySelectorAll('input[name="manage-game-modal-team-name"]')
    )
      .map((input) => input.value)
      .filter((input) => input !== "");

    console.log("Game Name:", gameName);
    console.log("Team Names:", teamNames);

    if (gameName === "") {
      throw new Error("Cannot submit with no game name");
    }

    const payload = {
      game_id: gameId,
      new_game_name: gameName,
      old_game_name: window.game_name,
      added_teams: teamNames,
    };

    // submit
    const res = await fetch("https://run.sebgillman.top/tiles/update-game", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to update game");
    res.text();

    // Close modal after submitting
    manageGameModal.style.display = "none";
    document.documentElement.style.overflowY = "auto"; // Prevent body scrolling

    // reset modal
    resetManageModal();
  });

  manageGameModalDeleteButton.addEventListener("click", async () => {
    const gameId = window.game_id;
    const password = window.game_password;

    // submit
    const res = await fetch(
      `https://run.sebgillman.top/tiles/game?game_id=${gameId}&password=${password}`,
      {
        method: "DELETE",
      }
    );
    if (!res.ok) throw new Error("Failed to update game");
    res.text();

    // Close modal after submitting
    manageGameModal.style.display = "none";
    document.documentElement.style.overflowY = "auto"; // Prevent body scrolling

    // reset modal
    resetManageModal();

    // refresh games
  });
});
