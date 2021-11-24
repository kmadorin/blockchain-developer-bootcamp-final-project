const Inchi = artifacts.require("Inchi");

contract("Inchi", function (accounts) {
  it("should assert true", async function () {
    console.log(`###: accounts`, accounts)
    await Inchi.deployed();
    return assert.isTrue(true);
  });
});
