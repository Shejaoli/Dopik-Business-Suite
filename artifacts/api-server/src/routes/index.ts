import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import itemsRouter from "./items";
import stockRouter from "./stock";
import purchasesRouter from "./purchases";
import salesRouter from "./sales";
import vendorsRouter from "./vendors";
import customersRouter from "./customers";
import payablesRouter from "./payables";
import receivablesRouter from "./receivables";
import expensesRouter from "./expenses";
import balancesRouter from "./balances";
import usersRouter from "./users";
import reportsRouter from "./reports";
import dashboardRouter from "./dashboard";
import loansRouter from "./loans";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(itemsRouter);
router.use(stockRouter);
router.use(purchasesRouter);
router.use(salesRouter);
router.use(vendorsRouter);
router.use(customersRouter);
router.use(payablesRouter);
router.use(receivablesRouter);
router.use(loansRouter);
router.use(expensesRouter);
router.use(balancesRouter);
router.use(usersRouter);
router.use(reportsRouter);
router.use(dashboardRouter);

export default router;
