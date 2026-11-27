// Matchmaker settings: the API URL and Auth Token from the Edgegap dashboard (Matchmaker > your
// matchmaker). Fill them in here, or override them in config.local.js next to this file (git-ignored,
// same shape), or with ?mm=<url>&token=<token> in the page URL. `profile` is the matchmaker profile
// name (default "arena", the one in matchmaker/arena.json); ?profile=<name> overrides it too.
//
// The Auth Token is the matchmaker's client token: it is made to ship in game clients and gives
// no access to the Edgegap account. Never put the Edgegap API token here.
export default {
  matchmakerUrl: "",
  matchmakerToken: "",
  profile: "arena",
};
