const { assert, expect } = require("chai");
const { deployments, ethers, getNamedAccounts } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("FundMe", async function () {
          let fundMe;
          let deployer;
          let MockV3Aggregator;
          const sendValue = ethers.utils.parseEther("1"); // conver 1 ether to 100000000
          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer; // or const accounts = await ethersgetSigner()
              await deployments.fixture(["all"]);
              fundMe = await ethers.getContract("FundMe", deployer);
              MockV3Aggregator = await ethers.getContract(
                  "MockV3Aggregator",
                  deployer
              );
          });

          describe("constructor", async function () {
              it("sets the aggregator address correctly", async function () {
                  const response = await fundMe.getPriceFeed();
                  assert.equal(response, MockV3Aggregator.address);
                  console.log(response);
              });
          });

          describe("receive and fallback ", async function () {
              it("receive works when you send enough ETH! ", async function () {
                  const accounts = await ethers.getSigners();
                  const sender = accounts[1];
                  const txData = {
                      to: fundMe.address,
                      value: sendValue,
                  };

                  const startingFundMeBalance =
                      await fundMe.provider.getBalance(fundMe.address);

                  const tx = await sender.sendTransaction(txData);
                  await tx.wait(1);

                  const endingFundMeBalance = await fundMe.provider.getBalance(
                      fundMe.address
                  );

                  assert.equal(
                      endingFundMeBalance.toString(),
                      startingFundMeBalance.add(sendValue).toString()
                  );
              });
              it("receive fails when you send not enough ETH! ", async function () {
                  const accounts = await ethers.getSigners();
                  const sender = accounts[1];
                  const txData = {
                      to: fundMe.address,
                  };

                  await expect(
                      sender.sendTransaction(txData)
                  ).to.be.revertedWith("You need to spend more ETH!");
              });

              it("fallback works when you send enough ETH! ", async function () {
                  const accounts = await ethers.getSigners();
                  const sender = accounts[1];
                  const txData = {
                      to: fundMe.address,
                      value: sendValue,
                      data: "0x00",
                  };

                  const startingFundMeBalance =
                      await fundMe.provider.getBalance(fundMe.address);

                  const tx = await sender.sendTransaction(txData);
                  await tx.wait(1);

                  const endingFundMeBalance = await fundMe.provider.getBalance(
                      fundMe.address
                  );

                  assert.equal(
                      endingFundMeBalance.toString(),
                      startingFundMeBalance.add(sendValue).toString()
                  );
              });
              it("fallback fails when you send not enough ETH! ", async function () {
                  const accounts = await ethers.getSigners();
                  const sender = accounts[1];
                  const txData = {
                      to: fundMe.address,
                      data: "0x00",
                  };

                  await expect(
                      sender.sendTransaction(txData)
                  ).to.be.revertedWith("You need to spend more ETH!");
              });
          });

          describe("fund", async function () {
              it("fails if you dont send enough ETH", async function () {
                  await expect(fundMe.fund()).to.be.revertedWith(
                      "You need to spend more ETH!"
                  );
              });
              it("update the amount funded structure", async function () {
                  await fundMe.fund({ value: sendValue });
                  const response = await fundMe.getAddressToAmountFunded(
                      deployer
                  );
                  assert.equal(response.toString(), sendValue.toString());
              });
              it("adds funder to array of getFunder", async function () {
                  await fundMe.fund({ value: sendValue });
                  const funder = await fundMe.getFunder(0);
                  assert.equal(funder, deployer);
              });
          });
          describe("withdraw", async function () {
              beforeEach(async function () {
                  await fundMe.fund({ value: sendValue });
              });

              it("can withdraw if from a single founder", async function () {
                  // Arrange
                  const startingFundMeBalance =
                      await fundMe.provider.getBalance(fundMe.address);
                  const startingDeployerBalance =
                      await fundMe.provider.getBalance(deployer);
                  // Act
                  const transactionResponse = await fundMe.withdraw();
                  const transactionReceipt = await transactionResponse.wait(1);

                  // Gas cost
                  const { gasUsed, effectiveGasPrice } = transactionReceipt;
                  const gasCost = gasUsed.mul(effectiveGasPrice);

                  const endingFundMeBalance = await fundMe.provider.getBalance(
                      fundMe.address
                  );
                  const endingDeployerBalance =
                      await fundMe.provider.getBalance(deployer);

                  // Assert
                  assert.equal(endingFundMeBalance, 0);
                  assert.equal(
                      startingFundMeBalance.add(startingDeployerBalance),
                      endingDeployerBalance.add(gasCost).toString()
                  );
              });

              it("allow us to withdraw with multiple getFunder", async function () {
                  // Arrange
                  const accounts = await ethers.getSigners();
                  for (let i = 1; i < 6; i++) {
                      const fundMeConnectedContract = await fundMe.connect(
                          accounts[i]
                      );
                      await fundMeConnectedContract.fund({ value: sendValue });
                  }
                  const startingFundMeBalance =
                      await fundMe.provider.getBalance(fundMe.address);
                  const startingDeployerBalance =
                      await fundMe.provider.getBalance(deployer);

                  // Act
                  const transactionResponse = await fundMe.withdraw();
                  const transactionReceipt = await transactionResponse.wait(1);

                  const { gasUsed, effectiveGasPrice } = transactionReceipt;
                  const gasCost = gasUsed.mul(effectiveGasPrice);

                  const endingFundMeBalance = await fundMe.provider.getBalance(
                      fundMe.address
                  );
                  const endingDeployerBalance =
                      await fundMe.provider.getBalance(deployer);

                  // Assert
                  assert.equal(endingFundMeBalance, 0);
                  assert.equal(
                      startingFundMeBalance.add(startingDeployerBalance),
                      endingDeployerBalance.add(gasCost).toString()
                  );

                  await expect(fundMe.getFunder(0)).to.be.reverted;

                  for (i = 1; i < 6; i++) {
                      assert.equal(
                          await fundMe.getAddressToAmountFunded(
                              accounts[i].address
                          ),
                          0
                      );
                  }
              });

              it("Only allows the owner to withdraw", async function () {
                  const accounts = await ethers.getSigners();
                  const fundMeConnectedContract = await fundMe.connect(
                      accounts[1]
                  );
                  await expect(
                      fundMeConnectedContract.withdraw()
                  ).to.be.revertedWith("FundMe__NotOwner");
              });
          });
          it("cheaper witdraw testing", async function () {
              // Arrange
              const accounts = await ethers.getSigners();
              for (let i = 1; i < 6; i++) {
                  const fundMeConnectedContract = await fundMe.connect(
                      accounts[i]
                  );
                  await fundMeConnectedContract.fund({ value: sendValue });
              }
              const startingFundMeBalance = await fundMe.provider.getBalance(
                  fundMe.address
              );
              const startingDeployerBalance = await fundMe.provider.getBalance(
                  deployer
              );

              // Act
              const transactionResponse = await fundMe.cheaperWithdraw();
              const transactionReceipt = await transactionResponse.wait(1);

              const { gasUsed, effectiveGasPrice } = transactionReceipt;
              const gasCost = gasUsed.mul(effectiveGasPrice);

              const endingFundMeBalance = await fundMe.provider.getBalance(
                  fundMe.address
              );
              const endingDeployerBalance = await fundMe.provider.getBalance(
                  deployer
              );

              // Assert
              assert.equal(endingFundMeBalance, 0);
              assert.equal(
                  startingFundMeBalance.add(startingDeployerBalance),
                  endingDeployerBalance.add(gasCost).toString()
              );

              await expect(fundMe.getFunder(0)).to.be.reverted;

              for (i = 1; i < 6; i++) {
                  assert.equal(
                      await fundMe.getAddressToAmountFunded(
                          accounts[i].address
                      ),
                      0
                  );
              }
          });
      });
