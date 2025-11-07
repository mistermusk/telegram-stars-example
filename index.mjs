import { Bot } from "grammy";

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

// Map is used to keep track of users who have paid. In a production scenario, replace with a database.
const paidUsers = new Map();

/*
  /start — Welcome message
*/
bot.command("start", (ctx) =>
  ctx.reply(
    `Welcome! I am a simple bot that can accept payments via Telegram Stars. The following commands are available:

/pay - to pay
/status - to check payment status
/refund - to refund payment
/withdraw - to withdraw all available Stars`,
  ),
);

/*
  /pay — Creates invoice for test payment
*/
bot.command("pay", (ctx) => {
  return ctx.replyWithInvoice(
    "Test Product",
    "Test description",
    "{}",
    "XTR",
    [{ amount: 1, label: "Test Product" }],
  );
});

/*
  pre_checkout_query — Must confirm pre-checkout
*/
bot.on("pre_checkout_query", (ctx) => {
  return ctx.answerPreCheckoutQuery(true).catch(() => {
    console.error("answerPreCheckoutQuery failed");
  });
});

/*
  successful_payment — Record the user's payment
*/
bot.on("message:successful_payment", (ctx) => {
  if (!ctx.message || !ctx.message.successful_payment || !ctx.from) {
    return;
  }

  paidUsers.set(
    ctx.from.id,
    ctx.message.successful_payment.telegram_payment_charge_id,
  );

  console.log(ctx.message.successful_payment);
});

/*
  /status — Check if user has paid
*/
bot.command("status", (ctx) => {
  const message = paidUsers.has(ctx.from.id)
    ? "✅ You have paid"
    : "❌ You have not paid yet";
  return ctx.reply(message);
});

/*
  /refund — Refund a user if they have paid
*/
bot.command("refund", (ctx) => {
  const userId = ctx.from.id;
  if (!paidUsers.has(userId)) {
    return ctx.reply("You have not paid yet, there is nothing to refund");
  }

  ctx.api
    .refundStarPayment(userId, paidUsers.get(userId))
    .then(() => {
      paidUsers.delete(userId);
      return ctx.reply("💸 Refund successful");
    })
    .catch(() => ctx.reply("Refund failed"));
});

/*
  /withdraw — Send all available Stars to the user
  This uses the Telegram Bot API method: transferStarPayment
  (Available in latest bot API versions)
*/
bot.command("withdraw", async (ctx) => {
  try {
    // First check bot balance (optional)
    const balance = await ctx.api.getStarTransactions();
    const available = balance.my_balance || 0;

    if (available <= 0) {
      return ctx.reply("😔 No Stars available to withdraw right now.");
    }

    // Send all available Stars to the user
    await ctx.api.transferStarPayment({
      user_id: ctx.from.id,
      amount: available,
      purpose: "Withdraw all available Stars",
    });

    return ctx.reply(`🌟 Successfully sent you ${available} Stars!`);
  } catch (err) {
    console.error("Withdraw error:", err);
    return ctx.reply("❌ Withdrawal failed. Try again later.");
  }
});

// Start bot
bot.start();
