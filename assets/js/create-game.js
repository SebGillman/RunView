document.addEventListener("DOMContentLoaded", function () {
  const createGameElement = document.getElementById("create-game");
  const createGameModal = document.getElementById("create-game-modal");
  const createGameModalCloseButton = document.getElementById(
    "create-game-modal-close"
  );
  const createGameModalSubmitButton = document.getElementById(
    "create-game-modal-submit"
  );
  const createGameModalGameName = document.getElementById(
    "create-game-modal-game-name"
  );
  const createGameModalTeamsCheckbox = document.getElementById(
    "create-game-modal-teams-checkbox"
  );
  const createGameModalTeamNamesContainer = document.getElementById(
    "create-game-modal-team-names-container"
  );
  const createGameModalTeamNamesDiv = document.getElementById(
    "create-game-modal-team-names"
  );
  const createGameModalAddTeamButton = document.getElementById(
    "create-game-modal-add-team"
  );
  const createGameModalTeamPickerContainer = document.getElementById(
    "create-game-modal-pick-team-container"
  );
  const createGameModalTeamPicker = document.getElementById(
    "create-game-modal-pick-team"
  );

  function resetCreateModal() {
    createGameModalGameName.value = "";
    createGameModalTeamsCheckbox.checked = false;

    createGameModalTeamNamesContainer.style.display = "none";
    createGameModalTeamPickerContainer.style.display = "none";

    createGameModalTeamNamesDiv.replaceChildren();
    createGameModalTeamNamesDiv.innerHTML = `
                  <input
                    type="text"
                    class = "text-field"
                    name="create-game-modal-team-name"
                    placeholder="Enter team name"
                  />`;
    createGameModalTeamPicker.replaceChildren();
    createGameModalTeamPicker.innerHTML = `<option disabled>Pick your team</option>`;
  }

  createGameElement.addEventListener("click", function () {
    document.documentElement.style.overflowY = "hidden"; // Prevent body scrolling
    // create game modal show
    console.log("create game modal");
    createGameModal.style.display = "flex";
  });

  createGameModalCloseButton.addEventListener("click", function () {
    createGameModal.style.display = "none";
    document.documentElement.style.overflowY = "auto"; // Prevent body scrolling
    resetCreateModal();
  });

  createGameModalTeamsCheckbox.addEventListener("change", () => {
    createGameModalTeamNamesContainer.style.display =
      createGameModalTeamsCheckbox.checked ? "block" : "none";
    createGameModalTeamPickerContainer.style.display =
      createGameModalTeamsCheckbox.checked ? "block" : "none";
  });

  createGameModalAddTeamButton.addEventListener("click", () => {
    const newTeamInput = document.createElement("input");
    newTeamInput.type = "text";
    newTeamInput.className = "text-field";
    newTeamInput.name = "create-game-modal-team-name";
    newTeamInput.placeholder = "Enter team name";
    createGameModalTeamNamesDiv.appendChild(newTeamInput);
  });

  createGameModalTeamNamesDiv.addEventListener("change", () => {
    createGameModalTeamPicker.innerHTML =
      "<option disabled>Pick your team</option>";
    Array.from(
      document.querySelectorAll('input[name="create-game-modal-team-name"]')
    )
      .filter((input) => input.value !== "")
      .forEach((input) => {
        const option = document.createElement("option");
        option.value = input.value;
        option.innerText = input.value;

        createGameModalTeamPicker.appendChild(option);
      });
  });

  createGameModalSubmitButton.addEventListener("click", async () => {
    const gameName = document.getElementById(
      "create-game-modal-game-name"
    ).value;
    const isTeams = createGameModalTeamsCheckbox.checked;
    const teamNames = Array.from(
      document.querySelectorAll('input[name="create-game-modal-team-name"]')
    )
      .map((input) => input.value)
      .filter((input) => input !== "");

    const ownerTeam = document.getElementById(
      "create-game-modal-pick-team"
    ).value;

    console.log("Game Name:", gameName);
    console.log("Is Teams:", isTeams);
    console.log("Team Names:", teamNames);
    console.log("Owner Team:", ownerTeam);

    if (gameName === "") {
      throw new Error("Cannot submit with no game name");
    }

    const noTeams = teamNames.length === 0;
    const noOwnerTeam = ownerTeam === "";
    const ownerTeamInvalid = teamNames.every((team) => team != ownerTeam);
    if (isTeams && noTeams) throw new Error("No teams specified for team game");
    if (isTeams && noOwnerTeam)
      throw new Error("Owner has not specified a team");
    if (isTeams && ownerTeamInvalid)
      throw new Error("Owner team not one of the specified teams");

    const payload = {
      game_name: gameName,
      is_team_game: isTeams,
      team_list: teamNames,
      owner_team: ownerTeam,
    };

    // submit
    const res = await fetch("https://run.sebgillman.top/tiles/create-game", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to create game");
    res.json();

    // Close modal after submitting
    document.documentElement.style.overflowY = "auto"; // Prevent body scrolling

    createGameModal.style.display = "none";

    // reset modal
    resetCreateModal();
  });
});
