import * as React from "react";
import { Modal, View, TouchableOpacity } from "react-native";
import { Button, Text, Form, Input, Item } from "native-base";

import Icon from "react-native-vector-icons/MaterialCommunityIcons";

export default class CodeInputComponent extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      code: "",
    };
  }

  onChangeText(text) {
    this.setState({ code: text });
  }

  render() {
    return (
      <Modal
        onRequestClose={() => null}
        animationType="slide"
        transparent={true}
        visible={this.props.visible}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#00000090",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <View style={{ backgroundColor: "white", width: 240 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                padding: 10,
                borderBottomWidth: 1,
                borderBottomColor: "#bbb",
              }}
            >
              <Text style={{ color: "gray", fontWeight: "bold" }}>
                Verify code
              </Text>
              <TouchableOpacity onPress={() => this.props.onClose()}>
                <Icon name="close" size={21} />
              </TouchableOpacity>
            </View>
            <Form>
              <Item regular>
                <Input onChangeText={text => this.onChangeText(text)} />
              </Item>
            </Form>
            <Button
              block
              success
              onPress={() => this.props.onVerify(this.state.code)}
              style={{ backgroundColor: "#427ec6" }}
            >
              <Text>Verify</Text>
            </Button>
            <Button block onPress={() => this.props.onResend()}>
              <Text>Resend Code</Text>
            </Button>
          </View>
        </View>
      </Modal>
    );
  }
}
