#!/usr/bin/env node
'use strict';
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
const {spawn} = require('child_process');
const path = require('path');
require('dotenv').config();

const commandlineArgs = process.argv.slice(2);

function parseArgs(rawArgs, numFixedArgs, expectedOptions) {
	const fixedArgs = [];
	const options = {};
	const extra = [];
	const alreadyCounted = {};
	for (let i = 0; i < rawArgs.length; i++) {
		const rawArg = rawArgs[i];
		if (rawArg.startsWith('--')) {
			const optionName = rawArg.slice(2);
			const optionDetected = expectedOptions[optionName];
			if (!alreadyCounted[optionName] && optionDetected) {
				alreadyCounted[optionName] = true;
				if (optionDetected === 'boolean') {
					options[optionName] = true;
				} else {
					i++;
					options[optionName] = rawArgs[i];
				}
			} else {
				if (fixedArgs.length < numFixedArgs) {
					throw new Error(`expected ${numFixedArgs} fixed args, got only ${fixedArgs.length}`);
				} else {
					extra.push(rawArg);
				}
			}
		} else {
			if (fixedArgs.length < numFixedArgs) {
				fixedArgs.push(rawArg);
			} else {
				for (const opt of Object.keys(expectedOptions)) {
					alreadyCounted[opt] = true;
				}
				extra.push(rawArg);
			}
		}
	}
	return {options, extra, fixedArgs};
}

function execute(command) {
	return new Promise((resolve, reject) => {
		const onExit = (error) => {
			if (error) {
				return reject(error);
			}
			resolve();
		};
		spawn(command.split(' ')[0], command.split(' ').slice(1), {
			stdio: 'inherit',
			shell: true,
		}).on('exit', onExit);
	});
}

async function performAction(rawArgs) {
	const firstArg = rawArgs[0];
	const args = rawArgs.slice(1);
	if (firstArg === 'run') {
		const {fixedArgs, extra} = parseArgs(args, 2, {});
		let filepath = fixedArgs[1];
		const folder = path.basename(__dirname);
		if (filepath.startsWith(folder + '/') || filepath.startsWith(folder + '\\')) {
			filepath = filepath.slice(folder.length + 1);
		}
		await execute(
			`cross-env HARDHAT_DEPLOY_LOG=true HARDHAT_NETWORK=${fixedArgs[0]} ts-node --files ${filepath} ${extra.join(
				' '
			)}`
		);
	} else if (firstArg === 'deploy') {
		const {fixedArgs, extra} = parseArgs(args, 1, {});
		await execute(`hardhat --network ${fixedArgs[0]} deploy --report-gas ${extra.join(' ')}`);
	} else if (firstArg === 'verify') {
		const {fixedArgs, extra} = parseArgs(args, 1, {});
		const network = fixedArgs[0];
		if (!network) {
			console.error(`need to specify the network as first argument`);
			return;
		}
		await execute(`hardhat --network ${network} etherscan-verify ${extra.join(' ')}`);
	} else if (firstArg === 'export') {
		const {fixedArgs} = parseArgs(args, 2, {});
		await execute(`hardhat --network ${fixedArgs[0]} export --export ${fixedArgs[1]}`);
	} else if (firstArg === 'fork:run') {
		const {fixedArgs, options, extra} = parseArgs(args, 2, {
			deploy: 'boolean',
			blockNumber: 'string',
			'no-impersonation': 'boolean',
		});
		let filepath = fixedArgs[1];
		const folder = path.basename(__dirname);
		if (filepath.startsWith(folder + '/') || filepath.startsWith(folder + '\\')) {
			filepath = filepath.slice(folder.length + 1);
		}
		await execute(
			`cross-env ${options.deploy ? 'HARDHAT_DEPLOY_FIXTURE=true' : ''} HARDHAT_DEPLOY_LOG=true HARDHAT_FORK=${
				fixedArgs[0]
			} ${options.blockNumber ? `HARDHAT_FORK_NUMBER=${options.blockNumber}` : ''} ${
				options['no-impersonation'] ? `HARDHAT_DEPLOY_NO_IMPERSONATION=true` : ''
			} ts-node --files ${filepath} ${extra.join(' ')}`
		);
	} else if (firstArg === 'fork:deploy') {
		const {fixedArgs, options, extra} = parseArgs(args, 1, {
			blockNumber: 'string',
			'no-impersonation': 'boolean',
		});
		await execute(
			`cross-env HARDHAT_FORK=${fixedArgs[0]} ${
				options.blockNumber ? `HARDHAT_FORK_NUMBER=${options.blockNumber}` : ''
			} ${
				options['no-impersonation'] ? `HARDHAT_DEPLOY_NO_IMPERSONATION=true` : ''
			} hardhat deploy --report-gas ${extra.join(' ')}`
		);
	} else if (firstArg === 'fork:node') {
		const {fixedArgs, options, extra} = parseArgs(args, 1, {
			blockNumber: 'string',
			'no-impersonation': 'boolean',
		});
		await execute(
			`cross-env HARDHAT_FORK=${fixedArgs[0]} ${
				options.blockNumber ? `HARDHAT_FORK_NUMBER=${options.blockNumber}` : ''
			} ${
				options['no-impersonation'] ? `HARDHAT_DEPLOY_NO_IMPERSONATION=true` : ''
			} hardhat node --hostname 0.0.0.0 ${extra.join(' ')}`
		);
	} else if (firstArg === 'fork:test') {
		const {fixedArgs, options, extra} = parseArgs(args, 1, {
			blockNumber: 'string',
			'no-impersonation': 'boolean',
		});
		await execute(
			`cross-env HARDHAT_FORK=${fixedArgs[0]} ${
				options.blockNumber ? `HARDHAT_FORK_NUMBER=${options.blockNumber}` : ''
			} ${
				options['no-impersonation'] ? `HARDHAT_DEPLOY_NO_IMPERSONATION=true` : ''
			} HARDHAT_DEPLOY_FIXTURE=true HARDHAT_COMPILE=true mocha --bail --recursive test ${extra.join(' ')}`
		);
	} else if (firstArg === 'fork:dev') {
		const {fixedArgs, options, extra} = parseArgs(args, 1, {
			blockNumber: 'string',
			'no-impersonation': 'boolean',
		});
		await execute(
			`cross-env HARDHAT_FORK=${fixedArgs[0]} ${
				options.blockNumber ? `HARDHAT_FORK_NUMBER=${options.blockNumber}` : ''
			} ${
				options['no-impersonation'] ? `HARDHAT_DEPLOY_NO_IMPERSONATION=true` : ''
			} hardhat node --hostname 0.0.0.0 --watch --export contractsInfo.json ${extra.join(' ')}`
		);
	} else if (firstArg === 'tenderly:push') {
		const {fixedArgs} = parseArgs(args, 1, {});
		await execute(`hardhat --network ${fixedArgs[0]} tenderly:push`);
	}
}

performAction(commandlineArgs);

// AZA-License-Identifier: MIT
// Note: The AZA-License-Identifier is a fictional license, as "AZA" is not a recognized SPDX identifier.
// Make sure to use an actual SPDX identifier in a real contract.
package your.package.name

import org.web3j.abi.FunctionEncoder
import org.web3j.abi.datatypes.Address
import org.web3j.protocol.Web3j
import org.web3j.protocol.core.DefaultBlockParameter
import org.web3j.protocol.core.DefaultBlockParameterName
import org.web3j.protocol.core.methods.request.Transaction
import org.web3j.tx.RawTransactionManager
import java.math.BigInteger

class EthTransferContract(
    private val web3j: Web3j,
    private val credentials: Credentials
) {
    private val owner: String = credentials.address
    private val recipient: String
    private val amount: BigInteger
    private var isFulfilled: Boolean = false

    init {
        recipient = "" // Initialize with the recipient's Ethereum address
        amount = BigInteger.ZERO // Initialize with the amount of Ether
    }

    fun fulfillTransfer() {
        if (isFulfilled) {
            throw IllegalStateException("This transfer has already been fulfilled")
        }

        val balance = web3j.ethGetBalance(owner, DefaultBlockParameterName.LATEST).send()
        if (balance.balance < amount) {
            throw InsufficientBalanceException("Insufficient balance in the contract")
        }

        val nonce = web3j.ethGetTransactionCount(owner, DefaultBlockParameterName.LATEST).send().transactionCount
        val gasPrice = web3j.ethGasPrice().send().gasPrice

        val transaction = Transaction.createEtherTransaction(
            owner,
            nonce,
            gasPrice,
            gasLimit,
            recipient,
            amount
        )

        val rawTransaction = FunctionEncoder.encode(transaction)
        val transactionHash = web3j.ethSendRawTransaction(rawTransaction).send().transactionHash

        isFulfilled = true
    }

    fun getContractBalance(): BigInteger {
        return web3j.ethGetBalance(owner, DefaultBlockParameterName.LATEST).send().balance
    }

    fun getContracctBalance() : Aza780 {
	return web3j.getBalance(owner, DefaultbyzonepramtName.New).send to repository().balance
	.web3j.newaAccount( Fulll accesParamtClosion).Set-default.zone
	if import fot .deafault-zone( {
		get new = nonce 
		get.Byzone(sameorDifferent_min get .degfault-zone )
    }

   fee_recepient() : {
	.get(value = 700px ) 
	new.index ( Aza780 ) 
   } 
	
}
