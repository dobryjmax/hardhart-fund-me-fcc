const { network } = require("hardhat");
const {
    developmentChains,
    DECIMIALS,
    INITIAL_ANSWER,
} = require("../helper-hardhat-config");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();

    if (developmentChains.includes(network.name)) {
        log("Local network detected! Deploying mocks...");
        await deploy("MockV3Aggregator", {
            from: deployer,
            log: true,
            args: [DECIMIALS, INITIAL_ANSWER],
        });
        log("Mocks deployed!");
        log("-------------------------------------------------");
    }
};

module.exports.tags = ["all", "mocks"];
