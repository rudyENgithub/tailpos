import * as React from "react";
import { Alert } from "react-native";
import { observer, inject } from "mobx-react/native";
import { ConfirmDialog } from "react-native-simple-dialogs";
import { Container, Toast } from "native-base";
import SplashScreen from "react-native-splash-screen";

import { BluetoothStatus } from "react-native-bluetooth-status";

import isFloat from "is-float";

import Sales from "@screens/Sales";

// TODO: receipt line (no access here to receipt lines)
import { ReceiptLine } from "../../store/PosStore/ReceiptStore";

import QuantityModalComponent from "@components/QuantityModalComponent";
import PriceModalComponent from "@components/PriceModalComponent";
import SummaryModalComponent from "@components/SummaryModalComponent";
import DiscountSelectionModalComponent from "@components/DiscountSelectionModalComponent";

const Sound = require("react-native-sound");
Sound.setCategory("Playback");
const beep = new Sound("beep.mp3", Sound.MAIN_BUNDLE);

@inject(
  "itemStore",
  "customerStore",
  "receiptStore",
  "discountStore",
  "categoryStore",
  "paymentStore",
  "printerStore",
  "shiftStore",
  "attendantStore",
  "stateStore",
)
@observer
export default class SalesContainer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      commissionArray: [],
    };
  }

  componentWillMount() {
    this.props.stateStore.initializeState();
    this.getBluetoothState();
    const { params } = this.props.navigation.state;
    if (params) {
      this.props.stateStore.changeValue(
        "cash",
        parseFloat(params.cash),
        "Sales",
      );
      this.props.stateStore.changeValue(
        "change",
        parseFloat(params.change),
        "Sales",
      );
    }
  }

  async getBluetoothState() {
    const isEnabled = await BluetoothStatus.state();
    if (!isEnabled) {
      BluetoothStatus.enable(true);
    }
  }
  componentDidMount() {
    if (this.props.stateStore.sales_state[0].selectedCategoryIndex === -1) {
      this.props.itemStore.itemsBasedOnCategorySelected("All");
    } else if (
      this.props.stateStore.sales_state[0].selectedCategoryIndex === -2
    ) {
      this.props.itemStore.favorites();
    }
    SplashScreen.hide();
  }

  onItemClick = index => {
    const line = ReceiptLine.create({
      item: index._id,
      sold_by: index.soldBy,
      item_name: index.name,
      qty: parseInt(1, 10),
      price: parseFloat(index.price),
      date: Date.now(),
    });
    this.props.receiptStore.setReceiptLine(line);
    if (index.price <= 0) {
      this.props.stateStore.changeValue("priceModalVisible", true, "Sales");
    } else {
      // let lengthValue = 0;
      // // line
      // if (index.taxesValue !== undefined) {
      //   lengthValue = index.taxesValue.length;
      // }
      const receipt = this.props.receiptStore.defaultReceipt;
      // if (lengthValue > 0) {
      //   receipt.addReceiptTax(index);
      // }
      // Add line to receipt
      receipt.add(line);
    }

    // Get receipt line
  };
  onBarcodeRead(barcodeValue) {
    if (this.props.stateStore.sales_state[0].barcodeStatus === "idle") {
      if (
        barcodeValue.toString() !== this.props.receiptStore.lastScannedBarcode
      ) {
        this.props.receiptStore.setLastScannedBarcode(barcodeValue);

        // play the beep
        beep.play();

        // barcode search promises
        this.props.itemStore.searchByBarcode(barcodeValue).then(result => {
          const resultItem = result;

          if (resultItem) {
            const line = ReceiptLine.create({
              item: resultItem._id,
              item_name: resultItem.name,
              qty: parseInt(1, 10),
              price: parseFloat(resultItem.price),
              date: Date.now(),
            });
            const lineIndex = this.props.receiptStore.defaultReceipt.add(line);
            this.props.receiptStore.setReceiptLine(
              this.props.receiptStore.defaultReceipt.lines[lineIndex],
            );
          } else {
            Toast.show({
              text: "No corresponding item based from the barcode found.",
              duration: 5000,
              type: "danger",
            });
          }
          this.props.stateStore.changeValue("barcodeStatus", "idle", "Sales");
        });

        // Pending barcode status
        this.props.stateStore.changeValue("barcodeStatus", "pending", "Sales");
      }
    }
  }

  onChangeSalesSearchText(text) {
    this.props.itemStore.search(text);
  }

  async searchStatusChange(bool) {
    BluetoothStatus.disable(bool);
    BluetoothStatus.enable(!bool);
    this.onCategoryClick(-1);
    this.props.stateStore.changeValue("searchStatus", bool, "Sales");
  }

  onCategoryClick = (id, index) => {
    this.props.stateStore.changeValue("selectedCategoryIndex", index, "Sales");

    if (index >= 0) {
      this.props.stateStore.changeValue("categoryFilter", true, "Sales");
      this.props.stateStore.changeValue("categoryValue", id, "Sales");

      this.props.itemStore.itemsBasedOnCategorySelected(id);
    } else if (index === -1) {
      this.props.stateStore.changeValue("categoryFilter", false, "Sales");

      this.props.itemStore.itemsBasedOnCategorySelected("All");
    } else if (index === -2) {
      this.props.itemStore.favorites();
    }
  };

  onDeleteClick() {
    this.props.stateStore.changeValue("deleteDialogVisible", true, "Sales");
  }

  onDeleteReceiptLine() {
    this.props.receiptStore.unselectReceiptLine();
    this.props.receiptStore.defaultReceipt.clear();
    this.props.stateStore.changeValue("deleteDialogVisible", false, "Sales");
  }

  onBarcodeClick() {
    this.props.stateStore.changeValue("salesListStatus", true, "Sales");
  }

  onCloseClick(text) {
    this.props.stateStore.changeValue("salesListStatus", false, "Sales");
  }

  onDiscountClick() {
    if (this.props.receiptStore.defaultReceipt.lines.length === 0) {
      Alert.alert("Discount", "Please add an item.", [{ text: "Ok" }]);
    } else {
      this.props.stateStore.changeValue("discountSelection", true, "Sales");
    }
  }

  onPaymentClick = text => {
    const { defaultShift } = this.props.shiftStore;

    if (defaultShift.shiftStarted && !defaultShift.shiftEnded) {
      if (
        this.props.shiftStore.defaultShift.attendant ===
        this.props.attendantStore.defaultAttendant.user_name
      ) {
        this.props.stateStore.setAmountDue(text.netTotal.toFixed(2));
        this.props.navigation.navigate("Payment", {
          receipt: true,
        });
      } else {
        Toast.show({
          text: "Its not your shift",
          buttonText: "Okay",
          type: "danger",
        });
      }
    } else {
      Toast.show({
        text: "Set the shift!",
        buttonText: "Okay",
        type: "danger",
      });
    }
  };

  onBluetoothScan(text) {
    let barcodeValue = text;
    this.props.stateStore.changeValue("barcodeScannerInput", "", "Sales");
    this.props.itemStore.searchByBarcode(barcodeValue).then(result => {
      // Get receipt line

      if (result) {
        const line = ReceiptLine.create({
          item: result._id,
          item_name: result.name,
          qty: parseInt(1, 10),
          price: parseFloat(result.price),
          date: Date.now(),
        });

        // line
        const receipt = this.props.receiptStore.defaultReceipt;

        // Add line to receipt
        const lineIndex = receipt.add(line);

        // Set the selectedline
        this.props.receiptStore.setReceiptLine(receipt.lines[lineIndex]);

        // zero price
        if (result.price <= 0) {
          this.props.stateStore.changeValue("priceModalVisible", true, "Sales");
        }
      } else {
        Toast.show({
          text: "No corresponding item based from the barcode found.",
          duration: 1000,
          buttonText: "Okay",
          type: "danger",
        });
      }
    });
  }
  onCancelDiscount(value) {
    this.props.discountStore.unsetDiscount();
    const receipt = this.props.receiptStore.defaultReceipt;
    receipt.cancelDiscount();
  }
  onDiscountChange(discount, index) {
    this.props.stateStore.changeValue("selectedDiscount", discount, "Sales");
    this.props.stateStore.changeValue("selectedDiscountIndex", index, "Sales");
  }

  onDiscountEdit(val) {
    const receipt = this.props.receiptStore.defaultReceipt;
    if (this.props.stateStore.sales_state[0].discountSelectionStatus) {
      receipt.addOnTheFlyReceiptDiscount({
        value: parseFloat(val.onTheFlyDiscountValue, 10),
        percentageType: val.percentageType,
      });
    } else {
      const discount = this.props.discountStore.rows[
        this.props.stateStore.sales_state[0].selectedDiscountIndex
      ];
      this.props.discountStore.setDiscount(discount);
      receipt.addReceiptDiscount(discount);
    }

    // hide modal
    this.props.stateStore.changeValue("discountSelection", false, "Sales");
  }

  confirmReceiptDeleteDialog() {
    return (
      <ConfirmDialog
        title="Confirm Delete"
        message="Are you sure to delete receipt lines?"
        visible={this.props.stateStore.sales_state[0].deleteDialogVisible}
        onTouchOutside={() =>
          this.props.stateStore.changeValue(
            "deleteDialogVisible",
            false,
            "Sales",
          )
        }
        positiveButton={{
          title: "YES",
          onPress: () => this.onDeleteReceiptLine(),
        }}
        negativeButton={{
          title: "NO",
          onPress: () =>
            this.props.stateStore.changeValue(
              "deleteDialogVisible",
              false,
              "Sales",
            ),
        }}
      />
    );
  }

  discountSelectionDialog() {
    return (
      <DiscountSelectionModalComponent
        discountData={this.props.discountStore.rows.slice()}
        currentDiscount={
          this.props.discountStore.selectedDiscount
            ? this.props.discountStore.selectedDiscount
            : ""
        }
        onCancelDiscount={value => this.onCancelDiscount(value)}
        onDiscountChange={(discount, index) =>
          this.onDiscountChange(discount, index)
        }
        selectedDiscount={this.props.stateStore.sales_state[0].selectedDiscount}
        discountSelection={
          this.props.stateStore.sales_state[0].discountSelection
        }
        discountSelectionStatus={
          this.props.stateStore.sales_state[0].discountSelectionStatus
        }
        onClick={() =>
          this.props.stateStore.changeValue("discountSelection", false, "Sales")
        }
        onDiscountEdit={value => this.onDiscountEdit(value)}
        changeSelectionStatus={value =>
          this.props.stateStore.changeValue(
            "discountSelectionStatus",
            value,
            "Sales",
          )
        }
      />
    );
  }

  // function is never used...
  // note to future: ikaw na bahala remove ani.
  onPriceExit(price) {
    if (!price) {
      Toast.show({
        text: "Zero-price items are not allowed. Please set the price.",
        buttonText: "Okay",
        duration: 5000,
        type: "warning",
      });
    } else {
      this.props.stateStore.changeValue("priceModalVisible", false, "Sales");
    }
  }

  onPriceSubmit(value) {
    // line

    const line = this.props.receiptStore.selectedLine;
    if (line) {
      line.setPrice(value);
      const receipt = this.props.receiptStore.defaultReceipt;
      // Add line to receipt
      receipt.add(line); // hide modal
      this.props.stateStore.changeValue("priceModalVisible", false, "Sales");
      this.props.stateStore.changeValue("addReceiptLineStatus", false, "Sales");

      // kwan bug(?)
      this.props.receiptStore.unselectReceiptLine();
    }
    // set the current line price
  }

  priceInputDialog() {
    // current price
    let price = 0;

    if (this.props.receiptStore.selectedLine) {
      price = this.props.receiptStore.selectedLine.price;
    }

    return (
      <PriceModalComponent
        visible={this.props.stateStore.sales_state[0].priceModalVisible}
        onClick={() => this.onPriceExit()}
        onClose={() =>
          this.props.stateStore.changeValue("priceModalVisible", false, "Sales")
        }
        onSubmit={value =>
          this.onPriceSubmit(value, this.props.receiptStore.selectedLine)
        }
        price={price}
      />
    );
  }

  onQuantityExit() {
    this.props.stateStore.changeValue("commissionArray", "[]", "Sales");

    this.props.stateStore.changeValue("quantityModalVisible", false, "Sales");
  }

  quantityEditDialog() {
    // current qty
    let qty = 0;
    let price = 0;
    let soldBy = "";

    let discount_rate = 0;
    if (this.props.receiptStore.selectedLine !== null) {
      qty = this.props.receiptStore.selectedLine.qty;
      price = this.props.receiptStore.selectedLine.price;
      soldBy = this.props.receiptStore.selectedLine.sold_by;
      discount_rate = this.props.receiptStore.selectedLine.discount_rate;
      if (
        JSON.parse(this.props.stateStore.sales_state[0].commissionArray)
          .length === 0
      ) {
        this.props.stateStore.changeValue(
          "commissionArray",
          this.props.receiptStore.selectedLine.commission_details,
          "Sales",
        );
      }
    }

    return (
      <QuantityModalComponent
        price={price}
        quantity={qty}
        soldBy={soldBy}
        discount_rate={discount_rate}
        onClick={() => this.onQuantityExit()}
        attendants={this.props.attendantStore.rows
          .slice()
          .filter(e => e.role !== "Cashier" && e.role !== "Owner")}
        visible={this.props.stateStore.sales_state[0].quantityModalVisible}
        addCommissionArray={objectData => this.addCommissionToArray(objectData)}
        commissionArray={JSON.parse(
          this.props.stateStore.sales_state[0].commissionArray,
        ).slice()}
        onSubmit={quantity => this.onQuantitySubmit(quantity)}
      />
    );
  }
  addCommissionToArray(objectData) {
    let commissionArray = JSON.parse(
      this.props.stateStore.sales_state[0].commissionArray,
    );
    let commissionValue = commissionArray.filter(
      attendant =>
        attendant.commission_attendant_id ===
        objectData.commission_attendant_id,
    );
    if (commissionValue.length === 0) {
      commissionArray.push(objectData);
      this.props.stateStore.changeValue(
        "commissionArray",
        JSON.stringify(commissionArray),
        "Sales",
      );
    } else {
      Toast.show({
        text: "Attendant already added",
        buttonText: "Okay",
        type: "danger",
      });
    }
  }
  summaryDialog() {
    return (
      <SummaryModalComponent
        currency={
          this.props.printerStore.companySettings[0].countryCode !== undefined
            ? this.props.printerStore.companySettings[0].countryCode
            : "PHP"
        }
        cash={this.props.stateStore.sales_state[0].cash}
        change={this.props.stateStore.sales_state[0].change}
        visibility={this.props.receiptStore.previousReceipt ? true : false}
        lines={
          this.props.receiptStore.previousReceipt
            ? this.props.receiptStore.previousReceipt.lines.slice()
            : []
        }
        details={
          this.props.receiptStore.previousReceipt &&
          this.props.receiptStore.previousReceipt.lines
            ? this.props.receiptStore.previousReceipt
            : {}
        }
        onClose={() => {
          this.props.stateStore.changeValue(
            "visibleSummaryModal",
            false,
            "Sales",
          );
          this.props.receiptStore.setPreviuosReceiptToNull();
        }}
      />
    );
  }
  onQuantitySubmit(quantity) {
    // line
    this.setState({ onChangeStatues: false });
    const line = this.props.receiptStore.selectedLine;

    const qty = parseFloat(quantity.quantity)
      ? parseFloat(quantity.quantity)
      : parseFloat(quantity.defaultQty);

    if (line.sold_by === "Each") {
      if (isFloat(qty)) {
        Toast.show({
          text: "Quantity not possible for each.",
          buttonText: "Okay",
          type: "warning",
        });
      } else {
        // Toast boy
        Toast.show({
          text: "Receipt line is modified.",
          buttonText: "Okay",
          duration: 5000,
        });
        line.setQuantity(Number(qty.toFixed(2)));
      }
    } else {
      // Toast boy
      Toast.show({
        text: "Receipt line is modified.",
        buttonText: "Okay",
        duration: 5000,
      });
      line.setQuantity(Number(qty.toFixed(2)));
    }

    const price = parseFloat(quantity.price)
      ? parseFloat(quantity.price)
      : parseFloat(quantity.defaultPrice);

    // set the price
    line.setPrice(Number(price.toFixed(2)));
    line.setDiscountRate(
      parseFloat(quantity.discount) > 0 ? parseFloat(quantity.discount) : 0,
    );
    // if (
    //   quantity.attendantName !== "No Attendant" &&
    //   quantity.commission_amount
    // ) {
    //   this.props.attendantStore.find(quantity.attendantName).then(result => {
    //     if (result) {
    //       let discountValue =
    //         parseFloat(quantity.discount) > 0
    //           ? price * qty -
    //             parseFloat(quantity.discount) / 100 * (price * qty)
    //           : price * qty;
    //       line.setCommissionAttendantName(result.user_name);
    //       line.setCommissionAttendantId(quantity.attendantName);
    //       line.setCommissionRate(result.commission, 10);
    //       line.setCommissionAmount(
    //         parseFloat(result.commission, 10) / 100 * discountValue,
    //       );
    //     }
    //   });
    // }
    // unselect the line
    line.setCommissionDetails(
      this.props.stateStore.sales_state[0].commissionArray,
    );
    this.props.receiptStore.unselectReceiptLine();
    this.props.stateStore.changeValue("commissionArray", "[]", "Sales");

    // remove the receipt store
    this.props.stateStore.changeValue("quantityModalVisible", false, "Sales");
  }

  onReceiptLineDelete = index => {
    // Unselect
    this.props.receiptStore.unselectReceiptLine();

    // Receipt
    const receipt = this.props.receiptStore.defaultReceipt;

    // Lines
    const receiptLine = receipt.lines[index];

    // Delete the receipt
    receipt.deleteLine(receiptLine);

    // Toast boy.
    Toast.show({
      text: "Receipt line is deleted.",
      buttonText: "Okay",
      duration: 5000,
    });

    // Unselect
  };

  onReceiptLineEdit = index => {
    const receipt = this.props.receiptStore.defaultReceipt;

    const receiptLine = receipt.lines[index];
    this.props.receiptStore.setReceiptLine(receiptLine);

    this.props.stateStore.changeValue("quantityModalVisible", true, "Sales");
  };

  onEndReached(text) {
    this.props.stateStore.changeValue("fetching", true, "Sales");
    if (this.props.stateStore.sales_state[0].fetching) {
      if (text === "item") {
        this.props.itemStore.getFromDb(20);
        this.props.stateStore.changeValue("fetching", false, "Sales");
      } else if (text === "category") {
        this.props.categoryStore.getFromDb(20);
        this.props.stateStore.changeValue("fetching", false, "Sales");
      }
    }
  }

  removeItemAsFavorite = () => {
    const { itemStore } = this.props;
    itemStore.selectedItem.setUnfavorite();
    itemStore.detachItemFromFavorites(itemStore.selectedItem);
    itemStore.unselectItem();
  };

  setItemAsFavorite = () => {
    const { itemStore } = this.props;
    itemStore.selectedItem.setFavorite();
    itemStore.unselectItem();
  };

  onLongPressItem(item) {
    this.props.itemStore.setItem(item);

    if (this.props.stateStore.sales_state[0].selectedCategoryIndex === -2) {
      Alert.alert(
        "Favorite Item", // title
        "Are you sure you want to remove item from favorites?",
        [
          { text: "No", style: "cancel" },
          { text: "Yes", onPress: this.removeItemAsFavorite },
        ],
      );
    } else {
      Alert.alert(
        "Favorite Item", // title
        "Are you sure you want to set item as favorite?",
        [
          { text: "No", style: "cancel" },
          { text: "Yes", onPress: this.setItemAsFavorite },
        ],
      );
    }
  }

  sortByName = (a, b) => (a.name < b.name ? -1 : 1);

  render() {
    return (
      <Container>
        {this.discountSelectionDialog()}
        {this.summaryDialog()}
        {this.confirmReceiptDeleteDialog()}
        {this.quantityEditDialog()}
        {this.priceInputDialog()}
        <Sales
          currency={
            this.props.printerStore.companySettings[0].countryCode !== undefined
              ? this.props.printerStore.companySettings[0].countryCode
              : "PHP"
          }
          categoryLengths={JSON.parse(this.props.itemStore.categoryLengths)}
          itemsLength={this.props.itemStore.itemsLength}
          bluetoothStatus={
            this.props.printerStore.bluetooth.length > 0
              ? this.props.printerStore.bluetooth[0].status
              : false
          }
          onBluetoothScan={text => this.onBluetoothScan(text)}
          onChangeSalesSearchText={text => this.onChangeSalesSearchText(text)}
          searchStatus={this.props.stateStore.sales_state[0].searchStatus}
          barcodeScannerInput={
            this.props.stateStore.sales_state[0].barcodeScannerInput
          }
          onChangeBarcodeScannerInput={text =>
            this.props.stateStore.changeValue(
              "barcodeScannerInput",
              text,
              "Sales",
            )
          }
          onSearchClick={text => this.searchStatusChange(text)}
          onBarcodeRead={text => this.onBarcodeRead(text)}
          onCloseClick={text => this.onCloseClick(text)}
          salesListStatus={this.props.stateStore.sales_state[0].salesListStatus}
          categoryData={this.props.categoryStore.rows
            .slice()
            .sort(this.sortByName)}
          itemData={
            this.props.stateStore.sales_state[0].categoryFilter ||
            this.props.stateStore.sales_state[0].searchStatus ||
            this.props.stateStore.sales_state[0].selectedCategoryIndex === -2
              ? this.props.itemStore.queriedRows.slice().sort(this.sortByName)
              : this.props.itemStore.rows.slice().sort(this.sortByName)
          }
          receiptDefault={this.props.receiptStore.defaultReceipt}
          navigation={this.props.navigation}
          selectedCategoryIndex={
            this.props.stateStore.sales_state[0].selectedCategoryIndex
          }
          onCategoryClick={this.onCategoryClick}
          onItemClick={this.onItemClick}
          // footer
          onDeleteClick={() => this.onDeleteClick()}
          onBarcodeClick={() => this.onBarcodeClick()}
          onDiscountClick={() => this.onDiscountClick()}
          // receipt line
          onReceiptLineEdit={this.onReceiptLineEdit}
          onReceiptLineDelete={this.onReceiptLineDelete}
          onPaymentClick={this.onPaymentClick}
          // empty rows
          isDiscountsEmpty={this.props.discountStore.isEmptyRows}
          onEndReached={text => this.onEndReached(text)}
          onLongPressItem={values => this.onLongPressItem(values)}
        />
      </Container>
    );
  }
}
