import { Connection, PublicKey, Cluster, clusterApiUrl, ParsedInstruction, PublicKeyInitData } from '@solana/web3.js';

export const SYSTEM_PROGRAM_ID: PublicKey = new PublicKey('11111111111111111111111111111111');
export const TOKEN_PROGRAM_ID: PublicKey = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

async function sleepWait(timeMs: number): Promise<void> {
  const result = new Promise<void>((resolve) => {
    setTimeout(resolve, timeMs);
  });
  return result;
}

export class Solana {
  network: string;
  connection: Connection = {} as Connection;

  constructor(network: string) {
    this.network = network;
  }

  connect(): void {
    const apiUrl = clusterApiUrl(this.network as Cluster);
    this.connection = new Connection(apiUrl, 'confirmed');
  }

  /// @throws (Error)
  async queryTransactionSignatures() {
    if (this.connection) {
      let lastSignature: undefined | string = '4BYSaNkAiRsu8ydeiQvVFXyaYAG7LrcZuC7ECZx5vLW4HWKvYh8pdFWg1cYz7Hd467zr6QQLQk49q3dVsPkyT2qJ';
      let foundTransaction = false;
      while (!foundTransaction) {
        const signatureOptions = {
          limit: 500,
        };
        if (lastSignature) {
          signatureOptions['before'] = lastSignature;
        }

        const txSignatures = await this.connection.getSignaturesForAddress(SYSTEM_PROGRAM_ID, signatureOptions);

        for (const confirmedSignature of txSignatures) {
          const tx = await this.connection.getParsedTransaction(confirmedSignature.signature, 'confirmed');
          if (!tx) {
            console.log('Tx not confirmed: ', confirmedSignature.signature);
            continue;
          }
          for (const instruction of tx.transaction.message.instructions) {
            const parsedInstruction = <ParsedInstruction>instruction;
            if (parsedInstruction.parsed?.type === 'createAccount') {
              if (parsedInstruction.parsed?.info.owner === TOKEN_PROGRAM_ID.toBase58()) {
                console.log(`Owner: ${parsedInstruction.parsed?.info.owner}`);
                console.log(`Account created by ${parsedInstruction.parsed?.info.source}`);
                console.log('New account for token program on tx: ', confirmedSignature.signature);
                const tokenAccount = parsedInstruction.parsed?.info.newAccount;
                if (tokenAccount) {
                  const accountInfo = await this.connection.getParsedAccountInfo(new PublicKey(tokenAccount as PublicKeyInitData));
                  const infoStruct = accountInfo.value?.data['parsed']['info'];
                  // check for an nft decimals 0 and only one token
                  if (infoStruct?.decimals === 0 && parseInt(infoStruct.supply) === 1) {
                    console.log(`${confirmedSignature.signature} includes account ${tokenAccount} with single token`);
                    foundTransaction = true;
                    break;
                  }
                }
              }
            }
            lastSignature = confirmedSignature.signature;
          }
          await sleepWait(50);
        }
      }
    } else {
      throw new Error('Not connected');
    }
  }
}
