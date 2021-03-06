import * as React from "react";
import { Alert } from "react-native";
import Sidebar from "@screens/Sidebar";
import { NavigationActions } from "react-navigation";

import { observer, inject } from "mobx-react/native";

@inject("attendantStore", "shiftStore")
@observer
export default class SidebarContainer extends React.Component {
  onListingClick() {
    const { defaultAttendant } = this.props.attendantStore;

    // Never never!
    if (defaultAttendant.role !== "Owner") {
      Alert.alert(
        "Role Error",
        "Unable to go to the listing. If you are the owner, re-login as owner in order to proceed.",
      );
    } else {
      this.props.navigation.navigate("Listing");
    }
  }

  onLogoutClick() {
    // const { defaultShift } = this.props.shiftStore;

    // if (defaultShift.shiftStarted && !defaultShift.shiftEnded) {
    //   Alert.alert(
    //     "Logout Error",
    //     "Unable to logout. Please close the shift first.",
    //   );
    // } else {
    const resetAction = NavigationActions.reset({
      index: 0,
      actions: [
        NavigationActions.navigate({
          routeName: "Pin",
        }),
      ],
    });

    this.props.navigation.dispatch(resetAction);
    // }
  }

  render() {
    return (
      <Sidebar
        navigation={this.props.navigation}
        onListingClick={() => this.onListingClick()}
        onLogoutClick={() => this.onLogoutClick()}
      />
    );
  }
}
