import { calculateHandOutcome } from "./payouts";

const noBonus = { micoAbajo: false, micoArriba: false, extraPerLoser: 0 };
const withBonus = { micoAbajo: true, micoArriba: false, extraPerLoser: 50 };

describe("calculateHandOutcome", () => {
  it("in dare mode, every loser owes a dare and no money changes hands", () => {
    const outcome = calculateHandOutcome({
      stakeType: "dare",
      ante: 0,
      winnerId: "p1",
      loserIds: ["p2", "p3"],
      bonuses: noBonus,
    });
    expect(outcome).toEqual({
      kind: "dare",
      winnerId: "p1",
      playersWhoOweADare: ["p2", "p3"],
      winnerReto: null,
    });
  });

  it("in dare mode, includes the winner's own current reto when one was given", () => {
    const outcome = calculateHandOutcome({
      stakeType: "dare",
      ante: 0,
      winnerId: "p1",
      loserIds: ["p2", "p3"],
      bonuses: noBonus,
      winnerReto: "Cantar el himno al revés",
    });
    expect(outcome).toEqual({
      kind: "dare",
      winnerId: "p1",
      playersWhoOweADare: ["p2", "p3"],
      winnerReto: "Cantar el himno al revés",
    });
  });

  it("in chips mode, the winner takes the pot plus any Mico extras from each loser", () => {
    const outcome = calculateHandOutcome({
      stakeType: "chips",
      ante: 50,
      winnerId: "p1",
      loserIds: ["p2", "p3"],
      bonuses: withBonus,
    });
    expect(outcome).toEqual({
      kind: "chips",
      winnerId: "p1",
      potWon: 150,
      extraPerLoser: { p2: 50, p3: 50 },
      patonaLoserIds: [],
    });
  });

  it("in money mode, the shape mirrors chips (no payment processing implemented)", () => {
    const outcome = calculateHandOutcome({
      stakeType: "money",
      ante: 10,
      winnerId: "p1",
      loserIds: ["p2"],
      bonuses: noBonus,
    });
    expect(outcome).toEqual({
      kind: "money",
      winnerId: "p1",
      potWon: 20,
      extraPerLoser: { p2: 0 },
      patonaLoserIds: [],
    });
  });

  it("charges Patona (one extra ante) only to the losers who never melded, stacking with Mico", () => {
    const outcome = calculateHandOutcome({
      stakeType: "chips",
      ante: 100,
      winnerId: "p1",
      loserIds: ["p2", "p3"],
      bonuses: withBonus, // +50 Mico to every loser
      patonaLoserIds: ["p2"], // only p2 never placed a meld
    });
    expect(outcome).toEqual({
      kind: "chips",
      winnerId: "p1",
      potWon: 300,
      extraPerLoser: { p2: 150, p3: 50 }, // p2: Mico + Patona, p3: Mico only
      // Broken out separately so the client can explain Patona and Mico as
      // the distinct bonuses they are, instead of only one opaque number.
      patonaLoserIds: ["p2"],
    });
  });

  it("patonaLoserIds only ever lists actual losers, never a stray id that wasn't passed in loserIds", () => {
    const outcome = calculateHandOutcome({
      stakeType: "chips",
      ante: 100,
      winnerId: "p1",
      loserIds: ["p2"],
      bonuses: noBonus,
      patonaLoserIds: ["p2", "not-a-real-loser"],
    });
    if (outcome.kind !== "chips") throw new Error("expected chips outcome");
    expect(outcome.patonaLoserIds).toEqual(["p2"]);
  });

  it("ignores Patona entirely in dare mode", () => {
    const outcome = calculateHandOutcome({
      stakeType: "dare",
      ante: 0,
      winnerId: "p1",
      loserIds: ["p2"],
      bonuses: noBonus,
      patonaLoserIds: ["p2"],
    });
    expect(outcome).toEqual({
      kind: "dare",
      winnerId: "p1",
      playersWhoOweADare: ["p2"],
      winnerReto: null,
    });
  });
});
