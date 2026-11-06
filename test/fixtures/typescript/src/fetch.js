import { fetchUser, handleError, show } from "./api.js";

fetchUser().then(show, handleError);
