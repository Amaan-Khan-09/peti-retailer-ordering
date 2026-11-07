"""Tally export. Assumption (labelled in the TDD): party ledgers are named by retailer code and stock items by SKU
name, matching Company A's Tally masters; the sales ledger is "Sales - Distribution". Free goods go as zero-rate lines."""
import csv
import io
from xml.sax.saxutils import escape

from .models import Order

SALES_LEDGER = "Sales - Distribution"


def _qty(line) -> str:
    return f"{line.qty} {'Case' if line.unit == 'CASE' else 'Pcs'}"


def to_xml(orders: list[Order]) -> str:
    vouchers = []
    for order in orders:
        entries = []
        for line in order.lines:
            entries.append(
                "<ALLINVENTORYENTRIES.LIST>"
                f"<STOCKITEMNAME>{escape(line.sku.name)}</STOCKITEMNAME>"
                f"<RATE>{line.unit_price}/Pcs</RATE>"
                f"<ACTUALQTY>{_qty(line)}</ACTUALQTY><BILLEDQTY>{_qty(line)}</BILLEDQTY>"
                f"<DISCOUNT>{line.discount}</DISCOUNT><AMOUNT>{line.gross - line.discount}</AMOUNT>"
                "</ALLINVENTORYENTRIES.LIST>")
            if line.free_cases:
                entries.append(
                    "<ALLINVENTORYENTRIES.LIST>"
                    f"<STOCKITEMNAME>{escape(line.sku.name)}</STOCKITEMNAME><RATE>0</RATE>"
                    f"<ACTUALQTY>{line.free_cases} Case</ACTUALQTY><BILLEDQTY>0 Case</BILLEDQTY><AMOUNT>0</AMOUNT>"
                    f"<NARRATION>Free goods: {escape(line.scheme_note or '')}</NARRATION>"
                    "</ALLINVENTORYENTRIES.LIST>")
        vouchers.append(
            '<TALLYMESSAGE xmlns:UDF="TallyUDF">'
            f'<VOUCHER VCHTYPE="Sales Order" ACTION="Create">'
            f"<DATE>{order.created_at:%Y%m%d}</DATE><VOUCHERNUMBER>{order.number}</VOUCHERNUMBER>"
            f"<PARTYLEDGERNAME>{escape(order.retailer.code)} {escape(order.retailer.shop_name)}</PARTYLEDGERNAME>"
            f"<NARRATION>{escape(order.note or 'Peti order')}; GST {order.gst_total}</NARRATION>"
            f"<LEDGERENTRIES.LIST><LEDGERNAME>{SALES_LEDGER}</LEDGERNAME><AMOUNT>{order.total}</AMOUNT></LEDGERENTRIES.LIST>"
            + "".join(entries) + "</VOUCHER></TALLYMESSAGE>")
    return ('<?xml version="1.0" encoding="UTF-8"?>\n<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>'
            "<BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC><REQUESTDATA>"
            + "".join(vouchers) + "</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>\n")


def to_csv(orders: list[Order]) -> str:
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(["order_number", "date", "retailer_code", "shop_name", "sku_code", "item", "qty", "unit",
                     "free_cases", "rate_per_piece", "gross", "discount", "gst", "line_total", "scheme"])
    for order in orders:
        for line in order.lines:
            writer.writerow([order.number, f"{order.created_at:%Y-%m-%d}", order.retailer.code, order.retailer.shop_name,
                             line.sku.code, line.sku.name, line.qty, line.unit.lower(), line.free_cases, line.unit_price,
                             line.gross, line.discount, line.gst, line.total, line.scheme_note or ""])
    return out.getvalue()
