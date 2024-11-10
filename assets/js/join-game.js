document.addEventListener("DOMContentLoaded", () => {
  const joinGameElement = document.getElementById("join-game");

  const joinGameModal = document.getElementById("join-game-modal");
  const joinGameModalClose = document.getElementById("join-game-modal-close");
  const joinGameModalGameId = document.getElementById(
    "join-game-modal-game-id"
  );
  const joinGameModalGamePassword = document.getElementById(
    "join-game-modal-game-password"
  );
  const joinGameModalSubmit = document.getElementById("join-game-modal-submit");

  function resetJoinModal() {
    document.body.style.overflow = "auto"; // Allow body scrolling
    document.documentElement.style.overflow = "auto"; // Allow body scrolling

    joinGameModal.style.display = "none";

    joinGameModalGameId.value = "";
    joinGameModalGamePassword.value = "";
  }

  joinGameElement.addEventListener("click", () => {
    document.body.style.overflow = "hidden"; // Prevent body scrolling
    document.documentElement.style.overflow = "hidden"; // Prevent body scrolling
    joinGameModal.style.display = "flex";
  });

  joinGameModalClose.addEventListener("click", resetJoinModal);

  joinGameModalSubmit.addEventListener("click", async () => {
    if (!joinGameModalGameId.value) {
      console.error("No game id provided");
      return;
    }

    const payload = {
      game_id: joinGameModalGameId.value,
      game_password: joinGameModalGamePassword.value,
    };

    const res = await fetch("https://run.sebgillman.top/tiles/add-player", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error(res.status, res.statusText);
      return;
    }

    await res.body.cancel();
    resetJoinModal();
  });
});
