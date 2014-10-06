# FormatString

This widget adds a user-defined string to your page, taking object attributes as input parameters.

## Contributing
For more information on contributing to this repository visit [Contributing to a GitHub repository] (https://world.mendix.com/display/howto50/Contributing+to+a+GitHub+repository)

## Typical usage scenario
 
Displaying multiple attributes as a single string

## Installation

Import the widget to your project and add the Format String to a dataview on a page. Configure the properties to determine how the widget will behave in your application.

## Features and limitations
 
- Supports multiple attributes
- Attributes can be retrieved one-deep
- Setting the same attribute multiple times using different date/time formatting is not supported.

## Properties

* *Display as* - Lets you set the HTML element type to be rendered, <div> or read-only <input>. If rendered as HTML, the Display string is interpreted as literal HTML. 
* *On click* - A microflow that is to be executed on click.
* *Display string* - The template string that should be displayed. 
* *Empty value replacement* - This string is used for the replace whenever the attribute is found empty.
* *Attributes* - The list of attributes that are used.
* *Datetime format* - Renders datetime attribute as date and/or time. Relative will render the date relative to current datetime.
* *Decimal Precision* - The number of decimals that should be considered for view.

