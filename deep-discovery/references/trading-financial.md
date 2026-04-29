# Trading / financial pattern

Use this pattern when evaluating trading systems, financial strategies, market edges, execution risk, backtests, capital constraints, or operational risk. Deliverable shape: revised strategy with specific parameters, P&L projections (conservative / base / optimistic), top risks with mitigations, build order and phased rollout plan.

## Foundation (Q1-Q10)

- What is the goal, and how do we get there?
- What is the starting capital and what are the constraints?
- What edge are we exploiting? Is it real or imagined?
- What are the fees and how do they affect profitability?
- What is the minimum move needed to break even on a trade?
- What markets or instruments are available?
- What is the realistic daily or monthly return target?
- What is the maximum acceptable drawdown?
- What historical data is available for validation?
- What does the competition look like?

## Mechanics (Q11-Q30)

- Entry signal definition with exact rules
- Exit signal definition with exact rules
- Position sizing formula
- Stop-loss mechanics: client-side vs exchange-side
- Order types and execution strategy
- Data pipeline for prices, indicators, and account state
- Latency requirements
- State persistence and crash recovery
- Risk management rules: daily limits, consecutive losses, exposure caps
- Market regime detection
- Slippage model
- Partial fill handling
- Spread vs mid-price assumptions
- Funding rate / borrow cost (for leveraged or short positions)
- Currency / instrument basis
- Timestamp and clock synchronization
- Idempotent order submission and reconciliation
- Alerting on stuck orders, missed fills, drifted state
- Manual override path
- Kill switch design

## Stress testing (Q31-Q50)

- What happens during a flash crash?
- What if the exchange goes down mid-position?
- What if spreads widen 10x during volatility?
- What if the strategy has 10 losses in a row?
- What if fees increase?
- What if liquidity dries up on target instruments?
- What if the market regime changes permanently?
- What is the risk of ruin at current position sizing?
- How does slippage affect real vs backtested returns?
- What if API rate limits change?
- What if a feed publishes a bad print?
- What if a corporate action / token swap / fork hits a held position?
- What if a regulatory halt occurs?
- What if our IP gets blocked?
- What if a credential leak forces a key rotation mid-day?

## Competitive analysis (Q51-Q65)

- Who else is running similar strategies?
- What advantages do institutional players have?
- What advantages do we have that they do not?
- Is this edge durable or will it be arbitraged away?
- What public research exists on this approach?
- What does the smart-money positioning look like?
- What does flow / order book signal about who's on the other side?

## Feasibility (Q66-Q80)

- Can this be backtested with available data?
- Is the backtest realistic: fees, slippage, partial fills, latency, survivorship bias?
- What is the minimum viable version?
- What infrastructure is needed?
- What is the total cost to operate?
- What's the paper-trade plan before going live?
- What is the live-with-tiny-capital plan before scaling?
- What is the monitoring stack?

## Refinement (Q81-Q90)

- Which parameters are most sensitive to changes?
- What can be simplified without losing edge?
- What monitoring is needed to detect strategy decay?
- How should the strategy adapt as capital grows?
- What's the rule for pausing the strategy?
- What's the rule for retiring the strategy?

## Synthesis (Q91-Q100)

- Revised strategy with specific parameters
- Honest P&L projections: conservative, base, optimistic
- Top risks and mitigations
- Build order and phased rollout plan
- Capital allocation phases
- Operational runbook outline
- Kill-switch and recovery plan
