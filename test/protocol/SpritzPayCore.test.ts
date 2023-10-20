/* eslint-disable @typescript-eslint/no-unused-vars */
import { FakeContract, smock } from "@defi-wonderland/smock";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai, { expect } from "chai";
import { BaseContract } from "ethers";
import { ethers } from "hardhat";

// export FACTORY="0x0a9190fb699b6ec18fea4dc2791548aa24e12f36"
// $ export CALLER="0x0f0f7b0a7287aea91d5f1b3125951dbb3d4f692e"
// $ export INIT_CODE_HASH="0x654d5810a68980ed0830d5d5e1fbcec180c8a689a5997e8de50aa6e41c96e00b"
import { SpritzPayCore, SpritzPayCore__factory } from "../../src/types";
import erc20Abi from "../abi/erc20.json";

chai.use(smock.matchers);

const setupFactoryFixture = async () => {
  const [deployer, admin] = await ethers.getSigners();

  const SpritzPayFactory = (await ethers.getContractFactory("SpritzPayCore")) as SpritzPayCore__factory;
  const spritzPay = (await SpritzPayFactory.connect(deployer).deploy(admin.address)) as SpritzPayCore;
  await spritzPay.deployed();

  const paymentToken = (await smock.fake(erc20Abi)) as FakeContract<BaseContract>;

  return {
    deployer,
    spritzPay,
    admin,
    paymentToken,
  };
};

describe.only("SpritzPayCore", function () {
  let deployer: SignerWithAddress;
  let admin: SignerWithAddress;
  let spritzPay: SpritzPayCore;
  let paymentToken: FakeContract<BaseContract>;

  beforeEach(async () => {
    ({ deployer, admin, spritzPay, paymentToken } = await loadFixture(setupFactoryFixture));
  });

  it("allow admins to add new payment tokens", async function () {
    const x = ethers.utils.keccak256(
      "0x60806040526040516200153a3803806200153a833981016040819052620000269162000180565b620000336000826200003b565b5050620001ab565b6000806200004a848462000078565b905080156200006f5760008481526001602052604090206200006d908462000126565b505b90505b92915050565b6000828152602081815260408083206001600160a01b038516845290915281205460ff166200011d576000838152602081815260408083206001600160a01b03861684529091529020805460ff19166001179055620000d43390565b6001600160a01b0316826001600160a01b0316847f2f8788117e7eff1d82e926ec794901d17c78024a50270940304540a733656f0d60405160405180910390a450600162000072565b50600062000072565b60006200006f836001600160a01b03841660008181526001830160205260408120546200011d5750815460018181018455600084815260208082209093018490558454848252828601909352604090209190915562000072565b6000602082840312156200019357600080fd5b81516001600160a01b03811681146200006f57600080fd5b61137f80620001bb6000396000f3fe60806040526004361061012d5760003560e01c80639010d07c116100a5578063aa2aedc411610074578063ca15c87311610059578063ca15c873146103a8578063d547741f146103c8578063d657c9bb146103e857600080fd5b8063aa2aedc414610366578063b8dc491b1461038857600080fd5b80639010d07c146102c057806391d14854146102e0578063a217fddf14610331578063a51254211461034657600080fd5b80632f2ff15d116100fc5780633b6e750f116100e15780633b6e750f146102605780633fcac5b2146102805780634a7dc8e0146102a057600080fd5b80632f2ff15d1461022057806336568abe1461024057600080fd5b806301ffc9a714610139578063248a9ca31461016e5780632983c4b8146101ac5780632b1eaf29146101ce57600080fd5b3661013457005b600080fd5b34801561014557600080fd5b50610159610154366004611097565b610408565b60405190151581526020015b60405180910390f35b34801561017a57600080fd5b5061019e6101893660046110d9565b60009081526020819052604090206001015490565b604051908152602001610165565b3480156101b857600080fd5b506101cc6101c7366004611114565b610464565b005b3480156101da57600080fd5b506004546101fb9073ffffffffffffffffffffffffffffffffffffffff1681565b60405173ffffffffffffffffffffffffffffffffffffffff9091168152602001610165565b34801561022c57600080fd5b506101cc61023b366004611131565b6104ee565b34801561024c57600080fd5b506101cc61025b366004611131565b610519565b34801561026c57600080fd5b5061015961027b366004611114565b610577565b34801561028c57600080fd5b506101cc61029b366004611161565b610584565b3480156102ac57600080fd5b506101cc6102bb366004611114565b61067d565b3480156102cc57600080fd5b506101fb6102db3660046111c6565b610693565b3480156102ec57600080fd5b506101596102fb366004611131565b60009182526020828152604080842073ffffffffffffffffffffffffffffffffffffffff93909316845291905290205460ff1690565b34801561033d57600080fd5b5061019e600081565b34801561035257600080fd5b506101cc610361366004611114565b6106b2565b34801561037257600080fd5b5061037b6106c8565b60405161016591906111e8565b34801561039457600080fd5b506101cc6103a3366004611242565b6106d9565b3480156103b457600080fd5b5061019e6103c33660046110d9565b610796565b3480156103d457600080fd5b506101cc6103e3366004611131565b6107ad565b3480156103f457600080fd5b506101cc610403366004611114565b6107d2565b60007fffffffff0000000000000000000000000000000000000000000000000000000082167f5a05180f00000000000000000000000000000000000000000000000000000000148061045e575061045e82610877565b92915050565b600061046f8161090e565b600480547fffffffffffffffffffffffff00000000000000000000000000000000000000001673ffffffffffffffffffffffffffffffffffffffff8416908117909155604080519182523360208301527ff2aee2de2705c86bdfda6c3ddaddc83ce3b729f850c62f38aa6c9fc93158a5d4910160405180910390a15050565b6000828152602081905260409020600101546105098161090e565b610513838361091b565b50505050565b73ffffffffffffffffffffffffffffffffffffffff81163314610568576040517f6697b23200000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b6105728282610950565b505050565b600061045e60028361097d565b61058f60028661097d565b6105e2576040517ff01157c300000000000000000000000000000000000000000000000000000000815273ffffffffffffffffffffffffffffffffffffffff861660048201526024015b60405180910390fd5b6004546106099073ffffffffffffffffffffffffffffffffffffffff8781169116866109ac565b6004546040805173ffffffffffffffffffffffffffffffffffffffff92831681526020810185905287831681830152606081018790529051839286811692908a16917f2415a5b602fd0082bd30dae862c30bbf8abbfcf39db48726b2d8ef555ee1abde9181900360800190a4505050505050565b60006106888161090e565b610572600283610a39565b60008281526001602052604081206106ab9083610a5b565b9392505050565b60006106bd8161090e565b610572600283610a67565b60606106d46002610a89565b905090565b60006106e48161090e565b6040517f70a0823100000000000000000000000000000000000000000000000000000000815230600482015261057290839073ffffffffffffffffffffffffffffffffffffffff8616906370a0823190602401602060405180830381865afa158015610754573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906107789190611270565b73ffffffffffffffffffffffffffffffffffffffff861691906109ac565b600081815260016020526040812061045e90610a96565b6000828152602081905260409020600101546107c88161090e565b6105138383610950565b60006107dd8161090e565b60008273ffffffffffffffffffffffffffffffffffffffff164760405160006040518083038185875af1925050503d8060008114610837576040519150601f19603f3d011682016040523d82523d6000602084013e61083c565b606091505b5050905080610572576040517f7aa60a9400000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b60007fffffffff0000000000000000000000000000000000000000000000000000000082167f7965db0b00000000000000000000000000000000000000000000000000000000148061045e57507f01ffc9a7000000000000000000000000000000000000000000000000000000007fffffffff0000000000000000000000000000000000000000000000000000000083161461045e565b6109188133610aa0565b50565b6000806109288484610b2a565b905080156106ab5760008481526001602052604090206109489084610a39565b509392505050565b60008061095d8484610c26565b905080156106ab5760008481526001602052604090206109489084610a67565b73ffffffffffffffffffffffffffffffffffffffff8116600090815260018301602052604081205415156106ab565b6040805173ffffffffffffffffffffffffffffffffffffffff8416602482015260448082018490528251808303909101815260649091019091526020810180517bffffffffffffffffffffffffffffffffffffffffffffffffffffffff167fa9059cbb00000000000000000000000000000000000000000000000000000000179052610572908490610ce1565b60006106ab8373ffffffffffffffffffffffffffffffffffffffff8416610d77565b60006106ab8383610dbe565b60006106ab8373ffffffffffffffffffffffffffffffffffffffff8416610de8565b606060006106ab83610edb565b600061045e825490565b60008281526020818152604080832073ffffffffffffffffffffffffffffffffffffffff8516845290915290205460ff16610b26576040517fe2517d3f00000000000000000000000000000000000000000000000000000000815273ffffffffffffffffffffffffffffffffffffffff82166004820152602481018390526044016105d9565b5050565b60008281526020818152604080832073ffffffffffffffffffffffffffffffffffffffff8516845290915281205460ff16610c1e5760008381526020818152604080832073ffffffffffffffffffffffffffffffffffffffff86168452909152902080547fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00166001179055610bbc3390565b73ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff16847f2f8788117e7eff1d82e926ec794901d17c78024a50270940304540a733656f0d60405160405180910390a450600161045e565b50600061045e565b60008281526020818152604080832073ffffffffffffffffffffffffffffffffffffffff8516845290915281205460ff1615610c1e5760008381526020818152604080832073ffffffffffffffffffffffffffffffffffffffff8616808552925280832080547fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0016905551339286917ff6391f5c32d9c69d2a47ea670b442974b53935d1edc7fd64eb21e047a839171b9190a450600161045e565b6000610d0373ffffffffffffffffffffffffffffffffffffffff841683610f37565b90508051600014158015610d28575080806020019051810190610d269190611289565b155b15610572576040517f5274afe700000000000000000000000000000000000000000000000000000000815273ffffffffffffffffffffffffffffffffffffffff841660048201526024016105d9565b6000818152600183016020526040812054610c1e5750815460018181018455600084815260208082209093018490558454848252828601909352604090209190915561045e565b6000826000018281548110610dd557610dd56112ab565b9060005260206000200154905092915050565b60008181526001830160205260408120548015610ed1576000610e0c6001836112da565b8554909150600090610e20906001906112da565b9050808214610e85576000866000018281548110610e4057610e406112ab565b9060005260206000200154905080876000018481548110610e6357610e636112ab565b6000918252602080832090910192909255918252600188019052604090208390555b8554869080610e9657610e96611314565b60019003818190600052602060002001600090559055856001016000868152602001908152602001600020600090556001935050505061045e565b600091505061045e565b606081600001805480602002602001604051908101604052809291908181526020018280548015610f2b57602002820191906000526020600020905b815481526020019060010190808311610f17575b50505050509050919050565b60606106ab83836000846000808573ffffffffffffffffffffffffffffffffffffffff168486604051610f6a9190611343565b60006040518083038185875af1925050503d8060008114610fa7576040519150601f19603f3d011682016040523d82523d6000602084013e610fac565b606091505b5091509150610fbc868383610fc6565b9695505050505050565b606082610fdb57610fd682611055565b6106ab565b8151158015610fff575073ffffffffffffffffffffffffffffffffffffffff84163b155b1561104e576040517f9996b31500000000000000000000000000000000000000000000000000000000815273ffffffffffffffffffffffffffffffffffffffff851660048201526024016105d9565b50806106ab565b8051156110655780518082602001fd5b6040517f1425ea4200000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b6000602082840312156110a957600080fd5b81357fffffffff00000000000000000000000000000000000000000000000000000000811681146106ab57600080fd5b6000602082840312156110eb57600080fd5b5035919050565b73ffffffffffffffffffffffffffffffffffffffff8116811461091857600080fd5b60006020828403121561112657600080fd5b81356106ab816110f2565b6000806040838503121561114457600080fd5b823591506020830135611156816110f2565b809150509250929050565b60008060008060008060c0878903121561117a57600080fd5b8635611185816110f2565b95506020870135611195816110f2565b94506040870135935060608701356111ac816110f2565b9598949750929560808101359460a0909101359350915050565b600080604083850312156111d957600080fd5b50508035926020909101359150565b6020808252825182820181905260009190848201906040850190845b8181101561123657835173ffffffffffffffffffffffffffffffffffffffff1683529284019291840191600101611204565b50909695505050505050565b6000806040838503121561125557600080fd5b8235611260816110f2565b91506020830135611156816110f2565b60006020828403121561128257600080fd5b5051919050565b60006020828403121561129b57600080fd5b815180151581146106ab57600080fd5b7f4e487b7100000000000000000000000000000000000000000000000000000000600052603260045260246000fd5b8181038181111561045e577f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fd5b7f4e487b7100000000000000000000000000000000000000000000000000000000600052603160045260246000fd5b6000825160005b81811015611364576020818601810151858301520161134a565b50600092019182525091905056fea164736f6c6343000815000a0000000000000000000000000f0f7b0a7287aea91d5f1b3125951dbb3d4f692e",
    );
    console.log({ x });
    const paymentTokensBefore = await spritzPay.acceptedPaymentTokens();
    expect(paymentTokensBefore).to.have.lengthOf(0);

    await spritzPay.connect(admin).addPaymentToken(paymentToken.address);

    const paymentTokensAfter = await spritzPay.acceptedPaymentTokens();

    expect(paymentTokensAfter).to.have.lengthOf(1);
    expect(paymentTokensAfter).to.contain(paymentToken.address);
  });

  it("allow for multiple payment tokens", async function () {
    await spritzPay.connect(admin).addPaymentToken(paymentToken.address);
    await spritzPay.connect(admin).addPaymentToken(deployer.address);

    const paymentTokensAfter = await spritzPay.acceptedPaymentTokens();

    expect(paymentTokensAfter).to.have.lengthOf(2);
    expect(paymentTokensAfter).to.contain(paymentToken.address);
    expect(paymentTokensAfter).to.contain(deployer.address);
  });

  it("prevents non-admins from adding new payment tokens", async function () {
    await expect(spritzPay.connect(deployer).addPaymentToken(paymentToken.address)).to.be.revertedWithCustomError(
      spritzPay,
      "AccessControlUnauthorizedAccount",
    );
  });

  it("allow admins to remove payment tokens", async function () {
    await spritzPay.connect(admin).addPaymentToken(paymentToken.address);

    const paymentTokensBefore = await spritzPay.acceptedPaymentTokens();

    expect(paymentTokensBefore).to.have.lengthOf(1);
    expect(paymentTokensBefore).to.contain(paymentToken.address);

    await spritzPay.connect(admin).removePaymentToken(paymentToken.address);

    const paymentTokensAfter = await spritzPay.acceptedPaymentTokens();
    expect(paymentTokensAfter).to.have.lengthOf(0);
  });

  it("prevents non-admins from removing payment tokens", async function () {
    await spritzPay.connect(admin).addPaymentToken(paymentToken.address);

    await expect(spritzPay.connect(deployer).removePaymentToken(paymentToken.address)).to.be.revertedWithCustomError(
      spritzPay,
      "AccessControlUnauthorizedAccount",
    );
  });

  it("correctly determines if a token is accepted or not", async function () {
    await spritzPay.connect(admin).addPaymentToken(paymentToken.address);

    let accepted = await spritzPay.isAcceptedToken(paymentToken.address);
    expect(accepted).to.be.true;

    accepted = await spritzPay.isAcceptedToken(deployer.address);
    expect(accepted).to.be.false;
  });

  it("initialized payment recipient as null address", async function () {
    const recipient = await spritzPay.paymentRecipient();
    expect(recipient).to.eq("0x0000000000000000000000000000000000000000");
  });

  it("allow admins to set the payment recipient", async function () {
    await spritzPay.connect(admin).setPaymentRecipient(deployer.address);

    const recipient = await spritzPay.paymentRecipient();
    expect(recipient).to.eq(deployer.address);
  });

  it("prevents non-admins from setting the payment recipient", async function () {
    await expect(spritzPay.connect(deployer).setPaymentRecipient(deployer.address)).to.be.revertedWithCustomError(
      spritzPay,
      "AccessControlUnauthorizedAccount",
    );
  });

  it("prevents setting the null address as the payment recipient", async function () {
    await expect(
      spritzPay.connect(admin).setPaymentRecipient("0x0000000000000000000000000000000000000000"),
    ).to.be.revertedWithCustomError(spritzPay, "ZeroAddress");
  });
});
